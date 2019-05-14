import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { AutoSizer } from 'react-virtualized';
// Services
import { getTimeSrv } from '../services/TimeSrv';
// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import { DataPanel } from './DataPanel';
import ErrorBoundary from '../../../core/components/ErrorBoundary/ErrorBoundary';
// Utils
import { applyPanelTimeOverrides, snapshotDataToPanelData } from 'app/features/dashboard/utils/panel';
import { PANEL_HEADER_HEIGHT } from 'app/core/constants';
import { profiler } from 'app/core/profiler';
import config from 'app/core/config';
import { LoadingState } from '@grafana/ui';
import templateSrv from 'app/features/templating/template_srv';
var DEFAULT_PLUGIN_ERROR = 'Error in plugin';
var PanelChrome = /** @class */ (function (_super) {
    tslib_1.__extends(PanelChrome, _super);
    function PanelChrome(props) {
        var _this = _super.call(this, props) || this;
        _this.timeSrv = getTimeSrv();
        _this.onRefresh = function () {
            console.log('onRefresh');
            if (!_this.isVisible) {
                return;
            }
            var panel = _this.props.panel;
            var timeData = applyPanelTimeOverrides(panel, _this.timeSrv.timeRange());
            _this.setState({
                refreshCounter: _this.state.refreshCounter + 1,
                timeRange: timeData.timeRange,
                timeInfo: timeData.timeInfo,
            });
        };
        _this.onRender = function () {
            _this.setState({
                renderCounter: _this.state.renderCounter + 1,
            });
        };
        _this.replaceVariables = function (value, extraVars, format) {
            var vars = _this.props.panel.scopedVars;
            if (extraVars) {
                vars = vars ? tslib_1.__assign({}, vars, extraVars) : extraVars;
            }
            return templateSrv.replace(value, vars, format);
        };
        _this.onDataResponse = function (dataQueryResponse) {
            if (_this.props.dashboard.isSnapshot()) {
                _this.props.panel.snapshotData = dataQueryResponse.data;
            }
            // clear error state (if any)
            _this.clearErrorState();
            // This event is used by old query editors and panel editor options
            _this.props.panel.events.emit('data-received', dataQueryResponse.data);
        };
        _this.onDataError = function (message, error) {
            if (_this.state.errorMessage !== message) {
                _this.setState({ errorMessage: message });
            }
            // this event is used by old query editors
            _this.props.panel.events.emit('data-error', error);
        };
        _this.onPanelError = function (message) {
            if (_this.state.errorMessage !== message) {
                _this.setState({ errorMessage: message });
            }
        };
        _this.renderPanelBody = function (width, height) {
            var panel = _this.props.panel;
            var _a = _this.state, refreshCounter = _a.refreshCounter, timeRange = _a.timeRange;
            var datasource = panel.datasource, targets = panel.targets;
            return (React.createElement(React.Fragment, null, _this.needsQueryExecution ? (React.createElement(DataPanel, { panelId: panel.id, datasource: datasource, queries: targets, timeRange: timeRange, isVisible: _this.isVisible, widthPixels: width, refreshCounter: refreshCounter, scopedVars: panel.scopedVars, onDataResponse: _this.onDataResponse, onError: _this.onDataError }, function (_a) {
                var loading = _a.loading, panelData = _a.panelData;
                return _this.renderPanelPlugin(loading, panelData, width, height);
            })) : (_this.renderPanelPlugin(LoadingState.Done, _this.getDataForPanel, width, height))));
        };
        _this.state = {
            refreshCounter: 0,
            renderCounter: 0,
            errorMessage: null,
        };
        return _this;
    }
    PanelChrome.prototype.componentDidMount = function () {
        this.props.panel.events.on('refresh', this.onRefresh);
        this.props.panel.events.on('render', this.onRender);
        this.props.dashboard.panelInitialized(this.props.panel);
    };
    PanelChrome.prototype.componentWillUnmount = function () {
        this.props.panel.events.off('refresh', this.onRefresh);
    };
    PanelChrome.prototype.clearErrorState = function () {
        if (this.state.errorMessage) {
            this.setState({ errorMessage: null });
        }
    };
    Object.defineProperty(PanelChrome.prototype, "isVisible", {
        get: function () {
            return !this.props.dashboard.otherPanelInFullscreen(this.props.panel);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PanelChrome.prototype, "hasPanelSnapshot", {
        get: function () {
            var panel = this.props.panel;
            return panel.snapshotData && panel.snapshotData.length;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PanelChrome.prototype, "needsQueryExecution", {
        get: function () {
            return this.hasPanelSnapshot || this.props.plugin.dataFormats.length > 0;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PanelChrome.prototype, "getDataForPanel", {
        get: function () {
            return this.hasPanelSnapshot ? snapshotDataToPanelData(this.props.panel) : null;
        },
        enumerable: true,
        configurable: true
    });
    PanelChrome.prototype.renderPanelPlugin = function (loading, panelData, width, height) {
        var _a = this.props, panel = _a.panel, plugin = _a.plugin;
        var _b = this.state, timeRange = _b.timeRange, renderCounter = _b.renderCounter;
        var PanelComponent = plugin.exports.reactPanel.panel;
        // This is only done to increase a counter that is used by backend
        // image rendering (phantomjs/headless chrome) to know when to capture image
        if (loading === LoadingState.Done) {
            profiler.renderingCompleted(panel.id);
        }
        return (React.createElement("div", { className: "panel-content" },
            React.createElement(PanelComponent, { loading: loading, panelData: panelData, timeRange: timeRange, options: panel.getOptions(plugin.exports.reactPanel.defaults), width: width - 2 * config.theme.panelPadding.horizontal, height: height - PANEL_HEADER_HEIGHT - config.theme.panelPadding.vertical, renderCounter: renderCounter, replaceVariables: this.replaceVariables })));
    };
    PanelChrome.prototype.render = function () {
        var _this = this;
        var _a = this.props, dashboard = _a.dashboard, panel = _a.panel, isFullscreen = _a.isFullscreen;
        var _b = this.state, errorMessage = _b.errorMessage, timeInfo = _b.timeInfo;
        var transparent = panel.transparent;
        var containerClassNames = "panel-container panel-container--absolute " + (transparent ? 'panel-transparent' : '');
        return (React.createElement(AutoSizer, null, function (_a) {
            var width = _a.width, height = _a.height;
            if (width === 0) {
                return null;
            }
            return (React.createElement("div", { className: containerClassNames },
                React.createElement(PanelHeader, { panel: panel, dashboard: dashboard, timeInfo: timeInfo, title: panel.title, description: panel.description, scopedVars: panel.scopedVars, links: panel.links, error: errorMessage, isFullscreen: isFullscreen }),
                React.createElement(ErrorBoundary, null, function (_a) {
                    var error = _a.error, errorInfo = _a.errorInfo;
                    if (errorInfo) {
                        _this.onPanelError(error.message || DEFAULT_PLUGIN_ERROR);
                        return null;
                    }
                    return _this.renderPanelBody(width, height);
                })));
        }));
    };
    return PanelChrome;
}(PureComponent));
export { PanelChrome };
//# sourceMappingURL=PanelChrome.js.map