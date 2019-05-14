import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import _ from 'lodash';
// Utils & Services
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getAngularLoader } from 'app/core/services/AngularLoader';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
var QueryEditorRow = /** @class */ (function (_super) {
    tslib_1.__extends(QueryEditorRow, _super);
    function QueryEditorRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.element = null;
        _this.angularQueryEditor = null;
        _this.state = {
            datasource: null,
            isCollapsed: false,
            loadedDataSourceValue: undefined,
            hasTextEditMode: false,
        };
        _this.onPanelDataError = function () {
            // Some query controllers listen to data error events and need a digest
            if (_this.angularQueryEditor) {
                // for some reason this needs to be done in next tick
                setTimeout(_this.angularQueryEditor.digest);
            }
        };
        _this.onPanelDataReceived = function () {
            // Some query controllers listen to data error events and need a digest
            if (_this.angularQueryEditor) {
                // for some reason this needs to be done in next tick
                setTimeout(_this.angularQueryEditor.digest);
            }
        };
        _this.onPanelRefresh = function () {
            if (_this.angularScope) {
                _this.angularScope.range = getTimeSrv().timeRange();
            }
        };
        _this.onToggleCollapse = function () {
            _this.setState({ isCollapsed: !_this.state.isCollapsed });
        };
        _this.onRunQuery = function () {
            _this.props.panel.refresh();
        };
        _this.onToggleEditMode = function () {
            if (_this.angularScope && _this.angularScope.toggleEditorMode) {
                _this.angularScope.toggleEditorMode();
                _this.angularQueryEditor.digest();
            }
            if (_this.state.isCollapsed) {
                _this.setState({ isCollapsed: false });
            }
        };
        _this.onRemoveQuery = function () {
            _this.props.onRemoveQuery(_this.props.query);
        };
        _this.onCopyQuery = function () {
            var copy = _.cloneDeep(_this.props.query);
            _this.props.onAddQuery(copy);
        };
        _this.onDisableQuery = function () {
            _this.props.query.hide = !_this.props.query.hide;
            _this.onRunQuery();
            _this.forceUpdate();
        };
        return _this;
    }
    QueryEditorRow.prototype.componentDidMount = function () {
        this.loadDatasource();
        this.props.panel.events.on('refresh', this.onPanelRefresh);
        this.props.panel.events.on('data-error', this.onPanelDataError);
        this.props.panel.events.on('data-received', this.onPanelDataReceived);
    };
    QueryEditorRow.prototype.componentWillUnmount = function () {
        this.props.panel.events.off('refresh', this.onPanelRefresh);
        this.props.panel.events.off('data-error', this.onPanelDataError);
        this.props.panel.events.off('data-received', this.onPanelDataReceived);
        if (this.angularQueryEditor) {
            this.angularQueryEditor.destroy();
        }
    };
    QueryEditorRow.prototype.getAngularQueryComponentScope = function () {
        var _a = this.props, panel = _a.panel, query = _a.query, dashboard = _a.dashboard;
        var datasource = this.state.datasource;
        return {
            datasource: datasource,
            target: query,
            panel: panel,
            dashboard: dashboard,
            refresh: function () { return panel.refresh(); },
            render: function () { return panel.render(); },
            events: panel.events,
            range: getTimeSrv().timeRange(),
        };
    };
    QueryEditorRow.prototype.loadDatasource = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _a, query, panel, dataSourceSrv, datasource;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, query = _a.query, panel = _a.panel;
                        dataSourceSrv = getDatasourceSrv();
                        return [4 /*yield*/, dataSourceSrv.get(query.datasource || panel.datasource)];
                    case 1:
                        datasource = _b.sent();
                        this.setState({
                            datasource: datasource,
                            loadedDataSourceValue: this.props.dataSourceValue,
                            hasTextEditMode: false,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    QueryEditorRow.prototype.componentDidUpdate = function () {
        var _this = this;
        var loadedDataSourceValue = this.state.loadedDataSourceValue;
        // check if we need to load another datasource
        if (loadedDataSourceValue !== this.props.dataSourceValue) {
            if (this.angularQueryEditor) {
                this.angularQueryEditor.destroy();
                this.angularQueryEditor = null;
            }
            this.loadDatasource();
            return;
        }
        if (!this.element || this.angularQueryEditor) {
            return;
        }
        var loader = getAngularLoader();
        var template = '<plugin-component type="query-ctrl" />';
        var scopeProps = { ctrl: this.getAngularQueryComponentScope() };
        this.angularQueryEditor = loader.load(this.element, scopeProps, template);
        this.angularScope = scopeProps.ctrl;
        // give angular time to compile
        setTimeout(function () {
            _this.setState({ hasTextEditMode: !!_this.angularScope.toggleEditorMode });
        }, 10);
    };
    QueryEditorRow.prototype.renderPluginEditor = function () {
        var _this = this;
        var _a = this.props, query = _a.query, onChange = _a.onChange;
        var datasource = this.state.datasource;
        if (datasource.pluginExports.QueryCtrl) {
            return React.createElement("div", { ref: function (element) { return (_this.element = element); } });
        }
        if (datasource.pluginExports.QueryEditor) {
            var QueryEditor = datasource.pluginExports.QueryEditor;
            return React.createElement(QueryEditor, { query: query, datasource: datasource, onChange: onChange, onRunQuery: this.onRunQuery });
        }
        return React.createElement("div", null, "Data source plugin does not export any Query Editor component");
    };
    QueryEditorRow.prototype.renderCollapsedText = function () {
        if (this.angularScope && this.angularScope.getCollapsedText) {
            return this.angularScope.getCollapsedText();
        }
        return null;
    };
    QueryEditorRow.prototype.render = function () {
        var _this = this;
        var _a = this.props, query = _a.query, inMixedMode = _a.inMixedMode;
        var _b = this.state, datasource = _b.datasource, isCollapsed = _b.isCollapsed, hasTextEditMode = _b.hasTextEditMode;
        var isDisabled = query.hide;
        var bodyClasses = classNames('query-editor-row__body gf-form-query', {
            'query-editor-row__body--collapsed': isCollapsed,
        });
        var rowClasses = classNames('query-editor-row', {
            'query-editor-row--disabled': isDisabled,
            'gf-form-disabled': isDisabled,
        });
        if (!datasource) {
            return null;
        }
        return (React.createElement("div", { className: rowClasses },
            React.createElement("div", { className: "query-editor-row__header" },
                React.createElement("div", { className: "query-editor-row__ref-id", onClick: this.onToggleCollapse },
                    isCollapsed && React.createElement("i", { className: "fa fa-caret-right" }),
                    !isCollapsed && React.createElement("i", { className: "fa fa-caret-down" }),
                    React.createElement("span", null, query.refId),
                    inMixedMode && React.createElement("em", { className: "query-editor-row__context-info" },
                        " (",
                        datasource.name,
                        ")"),
                    isDisabled && React.createElement("em", { className: "query-editor-row__context-info" }, " Disabled")),
                React.createElement("div", { className: "query-editor-row__collapsed-text", onClick: this.onToggleEditMode }, isCollapsed && React.createElement("div", null, this.renderCollapsedText())),
                React.createElement("div", { className: "query-editor-row__actions" },
                    hasTextEditMode && (React.createElement("button", { className: "query-editor-row__action", onClick: this.onToggleEditMode, title: "Toggle text edit mode" },
                        React.createElement("i", { className: "fa fa-fw fa-pencil" }))),
                    React.createElement("button", { className: "query-editor-row__action", onClick: function () { return _this.props.onMoveQuery(query, 1); } },
                        React.createElement("i", { className: "fa fa-fw fa-arrow-down" })),
                    React.createElement("button", { className: "query-editor-row__action", onClick: function () { return _this.props.onMoveQuery(query, -1); } },
                        React.createElement("i", { className: "fa fa-fw fa-arrow-up" })),
                    React.createElement("button", { className: "query-editor-row__action", onClick: this.onCopyQuery, title: "Duplicate query" },
                        React.createElement("i", { className: "fa fa-fw fa-copy" })),
                    React.createElement("button", { className: "query-editor-row__action", onClick: this.onDisableQuery, title: "Disable/enable query" },
                        isDisabled && React.createElement("i", { className: "fa fa-fw fa-eye-slash" }),
                        !isDisabled && React.createElement("i", { className: "fa fa-fw fa-eye" })),
                    React.createElement("button", { className: "query-editor-row__action", onClick: this.onRemoveQuery, title: "Remove query" },
                        React.createElement("i", { className: "fa fa-fw fa-trash" })))),
            React.createElement("div", { className: bodyClasses }, this.renderPluginEditor())));
    };
    return QueryEditorRow;
}(PureComponent));
export { QueryEditorRow };
//# sourceMappingURL=QueryEditorRow.js.map