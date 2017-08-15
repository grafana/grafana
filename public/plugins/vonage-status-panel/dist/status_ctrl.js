"use strict";

System.register(["app/plugins/sdk", "app/plugins/panel/graph/legend", "app/plugins/panel/graph/series_overrides_ctrl", "lodash", "app/core/time_series2", "app/core/core_module", "./css/status_panel.css!"], function (_export, _context) {
	"use strict";

	var MetricsPanelCtrl, _, TimeSeries, coreModule, _createClass, StatusPluginCtrl;

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	function _possibleConstructorReturn(self, call) {
		if (!self) {
			throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
		}

		return call && (typeof call === "object" || typeof call === "function") ? call : self;
	}

	function _inherits(subClass, superClass) {
		if (typeof superClass !== "function" && superClass !== null) {
			throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
		}

		subClass.prototype = Object.create(superClass && superClass.prototype, {
			constructor: {
				value: subClass,
				enumerable: false,
				writable: true,
				configurable: true
			}
		});
		if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
	}

	return {
		setters: [function (_appPluginsSdk) {
			MetricsPanelCtrl = _appPluginsSdk.MetricsPanelCtrl;
		}, function (_appPluginsPanelGraphLegend) {}, function (_appPluginsPanelGraphSeries_overrides_ctrl) {}, function (_lodash) {
			_ = _lodash.default;
		}, function (_appCoreTime_series) {
			TimeSeries = _appCoreTime_series.default;
		}, function (_appCoreCore_module) {
			coreModule = _appCoreCore_module.default;
		}, function (_cssStatus_panelCss) {}],
		execute: function () {
			_createClass = function () {
				function defineProperties(target, props) {
					for (var i = 0; i < props.length; i++) {
						var descriptor = props[i];
						descriptor.enumerable = descriptor.enumerable || false;
						descriptor.configurable = true;
						if ("value" in descriptor) descriptor.writable = true;
						Object.defineProperty(target, descriptor.key, descriptor);
					}
				}

				return function (Constructor, protoProps, staticProps) {
					if (protoProps) defineProperties(Constructor.prototype, protoProps);
					if (staticProps) defineProperties(Constructor, staticProps);
					return Constructor;
				};
			}();

			_export("StatusPluginCtrl", StatusPluginCtrl = function (_MetricsPanelCtrl) {
				_inherits(StatusPluginCtrl, _MetricsPanelCtrl);

				/** @ngInject */
				function StatusPluginCtrl($scope, $injector, $log, $filter, annotationsSrv) {
					_classCallCheck(this, StatusPluginCtrl);

					var _this = _possibleConstructorReturn(this, (StatusPluginCtrl.__proto__ || Object.getPrototypeOf(StatusPluginCtrl)).call(this, $scope, $injector));

					//this.log = $log.debug;
					_this.filter = $filter;

					_this.valueHandlers = ['Threshold', 'Disable Criteria', 'Text Only'];
					_this.aggregations = ['Last', 'First', 'Max', 'Min', 'Sum', 'Avg'];
					_this.displayTypes = ['Regular', 'Annotation'];

					_this.panel.flipTime = _this.panel.flipTime || 5;

					/** Bind events to functions **/
					_this.events.on('render', _this.onRender.bind(_this));
					_this.events.on('refresh', _this.postRefresh.bind(_this));
					_this.events.on('data-error', _this.onDataError.bind(_this));
					_this.events.on('data-received', _this.onDataReceived.bind(_this));
					_this.events.on('data-snapshot-load', _this.onDataReceived.bind(_this));
					_this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));

					_this.addFilters();
					return _this;
				}

				_createClass(StatusPluginCtrl, [{
					key: "addFilters",
					value: function addFilters() {
						var _this2 = this;

						coreModule.filter('numberOrText', function () {
							var numberOrTextFilter = function numberOrTextFilter(input) {
								if (angular.isNumber(input)) {
									return _this2.filter('number')(input);
								} else {
									return input;
								}
							};

							numberOrTextFilter.$stateful = true;
							return numberOrTextFilter;
						});

						coreModule.filter('numberOrTextWithRegex', function () {
							var numberOrTextFilter = function numberOrTextFilter(input, textRegex) {
								if (angular.isNumber(input)) {
									return _this2.filter('number')(input);
								} else {
									if (textRegex == null || textRegex.length == 0) {
										return input;
									} else {
										var regex = void 0;

										try {
											regex = new RegExp(textRegex);
										} catch (e) {
											return input;
										}

										var matchResults = input.match(regex);
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
				}, {
					key: "postRefresh",
					value: function postRefresh() {
						var _this3 = this;

						if (this.panel.fixedSpan) {
							this.panel.span = this.panel.fixedSpan;
						}

						this.measurements = this.panel.targets;

						/** Duplicate alias validation **/
						this.duplicates = false;

						this.measurements = _.filter(this.measurements, function (measurement) {
							return !measurement.hide;
						});

						_.each(this.measurements, function (m) {
							var res = _.filter(_this3.measurements, function (measurement) {
								return (m.alias == measurement.alias || m.target == measurement.target && m.target) && !m.hide;
							});

							if (res.length > 1) {
								_this3.duplicates = true;
							}
						});
					}
				}, {
					key: "onInitEditMode",
					value: function onInitEditMode() {
						this.addEditorTab('Options', 'public/plugins/vonage-status-panel/editor.html', 2);
					}
				}, {
					key: "setElementHeight",
					value: function setElementHeight() {
						this.$panelContainer.find('.status-panel').css('min-height', this.$panelContoller.height + 'px');
						this.minHeight = this.$panelContoller.height - 10;
					}
				}, {
					key: "setTextMaxWidth",
					value: function setTextMaxWidth() {
						var tail = ' …';
						var panelWidth = this.$panelContainer.innerWidth();
						if (isNaN(panelWidth)) panelWidth = parseInt(panelWidth.slice(0, -2), 10) / 12;
						panelWidth = panelWidth - 20;
						this.maxWidth = panelWidth;
					}
				}, {
					key: "onRender",
					value: function onRender() {
						var _this4 = this;

						this.setElementHeight();
						this.setTextMaxWidth();
						this.upgradeOldVersion();

						if (this.panel.clusterName) {
							this.panel.displayName = this.filter('interpolateTemplateVars')(this.panel.clusterName, this.$scope).replace(new RegExp(this.panel.namePrefix, 'i'), '');
						} else {
							this.panel.displayName = "";
						}

						if (this.panel.flipCard) {
							this.$panelContainer.addClass("effect-hover");
						} else {
							this.$panelContainer.removeClass("effect-hover");
						}

						var targets = this.panel.targets;

						this.crit = [];
						this.warn = [];
						this.disabled = [];
						this.display = [];
						this.annotation = [];

						_.each(this.series, function (s) {
							var target = _.find(targets, function (target) {
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

							if (_this4.validateRegex(target.valueDisplayRegex)) {
								s.valueDisplayRegex = target.valueDisplayRegex;
							}

							var value = void 0;
							switch (target.aggregation) {
								case 'Max':
									value = _.max(s.datapoints, function (point) {
										return point[0];
									})[0];
									value = s.stats.max;
									break;
								case 'Min':
									value = _.min(s.datapoints, function (point) {
										return point[0];
									})[0];
									value = s.stats.min;
									break;
								case 'Sum':
									value = 0;
									_.each(s.datapoints, function (point) {
										value += point[0];
									});
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
								_this4.handleThresholdStatus(s, target);
							} else if (target.valueHandler == "Disable Criteria") {
								_this4.handleDisabledStatus(s, target);
							} else if (target.valueHandler == "Text Only") {
								_this4.handleTextOnly(s, target);
							}
						});

						if (this.disabled.length > 0) {
							this.crit = [];
							this.warn = [];
							this.display = [];
						}

						this.autoFlip();
						this.handleCssDisplay();
						this.parseUri();
					}
				}, {
					key: "upgradeOldVersion",
					value: function upgradeOldVersion() {
						var _this5 = this;

						var targets = this.panel.targets;

						//Handle legacy code
						_.each(targets, function (target) {
							if (target.valueHandler == null) {
								target.valueHandler = target.displayType;
								if (target.valueHandler == "Annotation") {
									target.valueHandler = "Text Only";
								}
								target.displayType = _this5.displayTypes[0];
							}
						});
					}
				}, {
					key: "handleThresholdStatus",
					value: function handleThresholdStatus(series, target) {
						series.thresholds = StatusPluginCtrl.parseThresholds(target);
						series.inverted = series.thresholds.crit < series.thresholds.warn;
						series.display = target.display;

						var isCritical = false;
						var isWarning = false;
						var isCheckRanges = series.thresholds.warnIsNumber && series.thresholds.critIsNumber;
						if (isCheckRanges) {
							if (!series.inverted) {
								if (series.display_value >= series.thresholds.crit) {
									isCritical = true;
								} else if (series.display_value >= series.thresholds.warn) {
									isWarning = true;
								}
							} else {
								if (series.display_value <= series.thresholds.crit) {
									isCritical = true;
								} else if (series.display_value <= series.thresholds.warn) {
									isWarning = true;
								}
							}
						} else {
							if (series.display_value == series.thresholds.crit) {
								isCritical = true;
							} else if (series.display_value == series.thresholds.warn) {
								isWarning = true;
							}
						}

						if (isCritical) {
							this.crit.push(series);
							series.displayType = this.displayTypes[0];
						} else if (isWarning) {
							this.warn.push(series);
							series.displayType = this.displayTypes[0];
						} else if (series.display) {
							if (series.displayType == "Annotation") {
								this.annotation.push(series);
							} else {
								this.display.push(series);
							}
						}
					}
				}, {
					key: "handleDisabledStatus",
					value: function handleDisabledStatus(series, target) {
						series.displayType = this.displayTypes[0];
						series.disabledValue = target.disabledValue;

						if (series.display_value == series.disabledValue) {
							this.disabled.push(series);
						}
					}
				}, {
					key: "handleTextOnly",
					value: function handleTextOnly(series, target) {
						if (series.displayType == "Annotation") {
							this.annotation.push(series);
						} else {
							this.display.push(series);
						}
					}
				}, {
					key: "handleCssDisplay",
					value: function handleCssDisplay() {
						this.$panelContainer.removeClass('error-state warn-state disabled-state ok-state no-data-state');

						if (this.duplicates) {
							this.$panelContainer.addClass('error-state');
						} else if (this.disabled.length > 0) {
							this.$panelContainer.addClass('disabled-state');
						} else if (this.crit.length > 0) {
							this.$panelContainer.addClass('error-state');
						} else if (this.warn.length > 0) {
							this.$panelContainer.addClass('warn-state');
						} else if ((this.series == undefined || this.series.length == 0) && this.panel.isGrayOnNoData) {
							this.$panelContainer.addClass('no-data-state');
						} else {
							this.$panelContainer.addClass('ok-state');
						}
					}
				}, {
					key: "parseUri",
					value: function parseUri() {
						if (this.panel.links && this.panel.links.length > 0) {
							var link = this.panel.links[0];

							if (link.type == "absolute") {
								this.uri = link.url;
							} else {
								this.uri = 'dashboard/' + link.dashUri;
							}

							if (link.params) {
								this.uri += "?" + link.params;
							}

							this.targetBlank = link.targetBlank;
						} else {
							this.uri = undefined;
						}
					}
				}, {
					key: "validateRegex",
					value: function validateRegex(textRegex) {
						if (textRegex == null || textRegex.length == 0) {
							return true;
						}
						try {
							var regex = new RegExp(textRegex);
							return true;
						} catch (e) {
							return false;
						}
					}
				}, {
					key: "onDataReceived",
					value: function onDataReceived(dataList) {
						this.series = dataList.map(StatusPluginCtrl.seriesHandler.bind(this));
						this.render();
					}
				}, {
					key: "onDataError",
					value: function onDataError() {
						this.crit = [];
						this.warn = [];
					}
				}, {
					key: "$onDestroy",
					value: function $onDestroy() {
						if (this.timeoutId) clearInterval(this.timeoutId);
					}
				}, {
					key: "autoFlip",
					value: function autoFlip() {
						var _this6 = this;

						if (this.timeoutId) clearInterval(this.timeoutId);
						if (this.panel.flipCard && (this.crit.length > 0 || this.warn.length > 0 || this.disabled.length > 0)) {
							this.timeoutId = setInterval(function () {
								_this6.$panelContainer.toggleClass("flipped");
							}, this.panel.flipTime * 1000);
						}
					}
				}, {
					key: "link",
					value: function link(scope, elem, attrs, ctrl) {
						this.$panelContainer = elem.find('.panel-container');
						this.$panelContainer.addClass("st-card");
						this.$panelContoller = ctrl;
					}
				}], [{
					key: "parseThresholds",
					value: function parseThresholds(metricOptions) {
						var res = {};

						res.warnIsNumber = StatusPluginCtrl.isFloat(metricOptions.warn);
						if (res.warnIsNumber) {
							res.warn = parseFloat(metricOptions.warn);
						} else {
							res.warn = metricOptions.warn;
						}

						res.critIsNumber = StatusPluginCtrl.isFloat(metricOptions.crit);
						if (res.critIsNumber) {
							res.crit = parseFloat(metricOptions.crit);
						} else {
							res.crit = metricOptions.crit;
						}

						return res;
					}
				}, {
					key: "isFloat",
					value: function isFloat(val) {
						if (!isNaN(val) && val.toString().toLowerCase().indexOf('e') == -1) {
							return true;
						}
						return false;
					}
				}, {
					key: "seriesHandler",
					value: function seriesHandler(seriesData) {
						var series = new TimeSeries({
							datapoints: seriesData.datapoints,
							alias: seriesData.target
						});

						series.flotpairs = series.getFlotPairs("connected");

						return series;
					}
				}]);

				return StatusPluginCtrl;
			}(MetricsPanelCtrl));

			_export("StatusPluginCtrl", StatusPluginCtrl);

			StatusPluginCtrl.templateUrl = 'module.html';
		}
	};
});
//# sourceMappingURL=status_ctrl.js.map
