import {MetricsPanelCtrl} from "app/plugins/sdk";
import "app/plugins/panel/graph/legend";
import "app/plugins/panel/graph/series_overrides_ctrl";
import _ from "lodash";
import TimeSeries from "app/core/time_series2";
import coreModule from "app/core/core_module"

import './css/status_panel.css!';

export class StatusPluginCtrl extends MetricsPanelCtrl {
	/** @ngInject */
	constructor($scope, $injector, $log, $filter, annotationsSrv) {
		super($scope, $injector);

		//this.log = $log.debug;
		this.filter = $filter;

		this.valueHandlers = ['Threshold', 'Disable Criteria', 'Text Only'];
		this.aggregations = ['Last', 'First', 'Max', 'Min', 'Sum', 'Avg'];
		this.displayTypes = ['Regular', 'Annotation'];

		this.panel.flipTime = this.panel.flipTime || 5;

		/** Bind events to functions **/
		this.events.on('render', this.onRender.bind(this));
		this.events.on('refresh', this.postRefresh.bind(this));
		this.events.on('data-error', this.onDataError.bind(this));
		this.events.on('data-received', this.onDataReceived.bind(this));
		this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
		this.events.on('init-edit-mode', this.onInitEditMode.bind(this));

		this.addFilters()
	}

	addFilters() {
		coreModule.filter('numberOrText', () => {
			let numberOrTextFilter = (input) => {
				if(angular.isNumber(input)) {
					return this.filter('number')(input);
				} else {
					return input;
				}
			};

			numberOrTextFilter.$stateful = true;
			return numberOrTextFilter;
		});

		coreModule.filter('numberOrTextWithRegex', () => {
			let numberOrTextFilter = (input, textRegex) => {
				if(angular.isNumber(input)) {
					return this.filter('number')(input);
				} else {
					if(textRegex == null || textRegex.length == 0) {
						return input;
					} else {
						let regex;

						try {
							regex = new RegExp(textRegex);
						} catch (e) {
							return input;
						}

						let matchResults = input.match(regex);
						if (matchResults == null) {
							return input;
						} else {
							return matchResults[0];
						}
					}
				}
			};

			numberOrTextFilter.$stateful = true;
			return numberOrTextFilter;
		});
	}

	postRefresh() {
		if (this.panel.fixedSpan) {
			this.panel.span = this.panel.fixedSpan;
		}

		this.measurements = this.panel.targets;

		/** Duplicate alias validation **/
		this.duplicates = false;

		this.measurements = _.filter(this.measurements, (measurement) => {
			return !measurement.hide;
		});

		_.each(this.measurements, (m) => {
			let res = _.filter(this.measurements, (measurement) => {
				return (m.alias == measurement.alias || (m.target == measurement.target && m.target)) && !m.hide;
			});

			if (res.length > 1) {
				this.duplicates = true;
			}
		});
	}

	onInitEditMode() {
		this.addEditorTab('Options', 'public/plugins/vonage-status-panel/editor.html', 2);
	}

	setElementHeight() {
		this.$panelContainer.find('.status-panel').css('min-height', this.$panelContoller.height + 'px');
		this.minHeight = this.$panelContoller.height-10;
	}

	setTextMaxWidth() {
		let tail = ' …';
		let panelWidth = this.$panelContainer.innerWidth();
		if (isNaN(panelWidth))
			panelWidth = parseInt(panelWidth.slice(0, -2), 10) / 12;
		panelWidth = panelWidth - 20;
		this.maxWidth = panelWidth;
	}

	onRender() {
		this.setElementHeight();
		this.setTextMaxWidth();
		this.upgradeOldVersion();

		if (this.panel.clusterName) {
			this.panel.displayName =
				this.filter('interpolateTemplateVars')(this.panel.clusterName, this.$scope)
					.replace(new RegExp(this.panel.namePrefix, 'i'), '');
		} else {
			this.panel.displayName = "";
		}

		if(this.panel.flipCard){
		  this.$panelContainer.addClass("effect-hover");
		} else {
		  this.$panelContainer.removeClass("effect-hover");
		}

		let targets = this.panel.targets;

		this.crit = [];
		this.warn = [];
		this.disabled = [];
		this.display = [];
		this.annotation = [];

		_.each(this.series, (s) => {
			let target = _.find(targets, (target) => {
				return target.alias == s.alias || target.target == s.alias;
			});

			if (!target) {
				return;
			}

			s.alias = target.alias;
			s.url = target.url;
			s.display = true;
			s.displayType = target.displayType;
			s.valueDisplayRegex = "";

			if(this.validateRegex(target.valueDisplayRegex)) {
				s.valueDisplayRegex = target.valueDisplayRegex;
			}

			let value;
			switch (target.aggregation) {
				case 'Max':
					value = _.max(s.datapoints, (point) => { return point[0]; })[0];
					value = s.stats.max;
					break;
				case 'Min':
					value = _.min(s.datapoints, (point) => { return point[0]; })[0];
					value = s.stats.min;
					break;
				case 'Sum':
					value = 0;
					_.each(s.datapoints, (point) => { value += point[0] });
					value = s.stats.total;
					break;
				case 'Avg':
					value = s.stats.avg;
					break;
				case 'First':
					value = s.datapoints[0][0];
					break;
				default:
					value = s.datapoints[s.datapoints.length - 1][0];
			}

			s.display_value = value;

			if (target.valueHandler == "Threshold") {
				this.handleThresholdStatus(s, target);
			}
			else if (target.valueHandler == "Disable Criteria") {
				this.handleDisabledStatus(s,target);
			}
			else if (target.valueHandler == "Text Only") {
				this.handleTextOnly(s, target);
			}
		});

		if(this.disabled.length > 0) {
			this.crit = [];
			this.warn = [];
			this.display = [];
		}

		this.autoFlip();
		this.handleCssDisplay();
		this.parseUri();
	}

	upgradeOldVersion() {
		let targets = this.panel.targets;

		//Handle legacy code
		_.each(targets, (target) => {
			if(target.valueHandler == null) {
				target.valueHandler = target.displayType;
				if(target.valueHandler == "Annotation") {
					target.valueHandler = "Text Only"
				}
				target.displayType = this.displayTypes[0];
			}
		});
	}

	handleThresholdStatus(series, target) {
		series.thresholds = StatusPluginCtrl.parseThresholds(target);
		series.inverted = series.thresholds.crit < series.thresholds.warn;
		series.display = target.display;

		let isCritical = false;
		let isWarning = false;
		let isCheckRanges = series.thresholds.warnIsNumber && series.thresholds.critIsNumber;
		if (isCheckRanges) {
			if (!series.inverted) {
				if (series.display_value >= series.thresholds.crit) {
					isCritical = true
				} else if (series.display_value >= series.thresholds.warn) {
					isWarning = true
				}
			} else {
				if (series.display_value <= series.thresholds.crit) {
					isCritical = true
				} else if (series.display_value <= series.thresholds.warn) {
					isWarning = true
				}
			}
		} else {
			if (series.display_value == series.thresholds.crit) {
				isCritical = true
			} else if (series.display_value == series.thresholds.warn) {
				isWarning = true
			}
		}

		if(isCritical) {
			this.crit.push(series);
			series.displayType = this.displayTypes[0]
		} else if(isWarning) {
			this.warn.push(series);
			series.displayType = this.displayTypes[0]
		} else if (series.display) {
			if(series.displayType == "Annotation") {
				this.annotation.push(series);
			} else {
				this.display.push(series);
			}
		}
	}

	handleDisabledStatus(series, target) {
		series.displayType = this.displayTypes[0];
		series.disabledValue = target.disabledValue;

		if (series.display_value == series.disabledValue) {
			this.disabled.push(series);
		}
	}

	handleTextOnly(series, target) {
		if(series.displayType == "Annotation") {
			this.annotation.push(series);
		} else {
			this.display.push(series);
		}
	}

	handleCssDisplay() {
		this.$panelContainer.removeClass('error-state warn-state disabled-state ok-state no-data-state');

		if(this.duplicates) {
			this.$panelContainer.addClass('error-state');
		} else if (this.disabled.length > 0) {
			this.$panelContainer.addClass('disabled-state');
		} else if (this.crit.length > 0) {
			this.$panelContainer.addClass('error-state');
		} else if (this.warn.length > 0) {
			this.$panelContainer.addClass('warn-state');
		} else if((this.series == undefined || this.series.length == 0) && this.panel.isGrayOnNoData) {
			this.$panelContainer.addClass('no-data-state');
		} else {
			this.$panelContainer.addClass('ok-state');
		}
	}

	parseUri() {
		if (this.panel.links && this.panel.links.length > 0) {
			let link = this.panel.links[0];

			if (link.type == "absolute") {
				this.uri = link.url;
			} else {
				this.uri = 'dashboard/' + link.dashUri;
			}

			if (link.params) {
				this.uri +=  "?" + link.params;
			}

			this.targetBlank = link.targetBlank;
		} else {
			this.uri = undefined;
		}
	}

	validateRegex(textRegex) {
		if(textRegex == null || textRegex.length == 0) {
			return true
		}
		try {
			let regex = new RegExp(textRegex);
			return true
		} catch(e) {
			return false
		}
	}

	static parseThresholds(metricOptions) {
		let res = {};

		res.warnIsNumber = StatusPluginCtrl.isFloat(metricOptions.warn)
		if(res.warnIsNumber) {
			res.warn = parseFloat(metricOptions.warn);
		} else {
			res.warn = metricOptions.warn;
		}

		res.critIsNumber = StatusPluginCtrl.isFloat(metricOptions.crit);
		if(res.critIsNumber) {
			res.crit = parseFloat(metricOptions.crit);
		} else {
			res.crit = metricOptions.crit;
		}

		return res;
	}

	static isFloat(val) {
		if (!isNaN(val) && val.toString().toLowerCase().indexOf('e') == -1) {
			return true;
		}
		return false;
	}

	onDataReceived(dataList) {
		this.series = dataList.map(StatusPluginCtrl.seriesHandler.bind(this));
		this.render();
	}

	onDataError() {
		this.crit = [];
		this.warn = [];
	}

	static seriesHandler(seriesData) {
		var series = new TimeSeries({
			datapoints: seriesData.datapoints,
			alias: seriesData.target
		});

		series.flotpairs = series.getFlotPairs("connected");

		return series;
	}

	$onDestroy() {
		if(this.timeoutId) clearInterval(this.timeoutId);
	}

	autoFlip() {
		if (this.timeoutId) clearInterval(this.timeoutId);
		if (this.panel.flipCard && (this.crit.length > 0 || this.warn.length > 0 || this.disabled.length > 0)) {
			this.timeoutId = setInterval(() => {
				this.$panelContainer.toggleClass("flipped");
			}, this.panel.flipTime * 1000);
		}
	}

	link(scope, elem, attrs, ctrl) {
		this.$panelContainer = elem.find('.panel-container');
		this.$panelContainer.addClass("st-card");
		this.$panelContoller = ctrl;
	}
}

StatusPluginCtrl.templateUrl = 'module.html';
