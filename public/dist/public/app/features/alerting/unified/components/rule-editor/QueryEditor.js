import { __assign, __extends, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { getDefaultRelativeTimeRange, LoadingState, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, HorizontalGroup, Icon, stylesFactory, Tooltip } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { QueryRows } from './QueryRows';
import { dataSource as expressionDatasource, ExpressionDatasourceUID, } from 'app/features/expressions/ExpressionDatasource';
import { getNextRefIdChar } from 'app/core/utils/query';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { AlertingQueryRunner } from '../../state/AlertingQueryRunner';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { isExpressionQuery } from 'app/features/expressions/guards';
var QueryEditor = /** @class */ (function (_super) {
    __extends(QueryEditor, _super);
    function QueryEditor(props) {
        var _a;
        var _this = _super.call(this, props) || this;
        _this.onRunQueries = function () {
            var queries = _this.queries;
            _this.runner.run(queries);
        };
        _this.onCancelQueries = function () {
            _this.runner.cancel();
        };
        _this.onChangeQueries = function (queries) {
            _this.queries = queries;
            _this.props.onChange(queries);
        };
        _this.onDuplicateQuery = function (query) {
            var queries = _this.queries;
            _this.onChangeQueries(addQuery(queries, query));
        };
        _this.onNewAlertingQuery = function () {
            var queries = _this.queries;
            var defaultDataSource = getDatasourceSrv().getInstanceSettings('default');
            if (!defaultDataSource) {
                return;
            }
            _this.onChangeQueries(addQuery(queries, {
                datasourceUid: defaultDataSource.uid,
                model: {
                    refId: '',
                    datasource: {
                        type: defaultDataSource.type,
                        uid: defaultDataSource.uid,
                    },
                },
            }));
        };
        _this.onNewExpressionQuery = function () {
            var queries = _this.queries;
            _this.onChangeQueries(addQuery(queries, {
                datasourceUid: ExpressionDatasourceUID,
                model: expressionDatasource.newQuery({
                    type: ExpressionQueryType.classic,
                    conditions: [defaultCondition],
                }),
            }));
        };
        _this.state = { panelDataByRefId: {} };
        _this.runner = new AlertingQueryRunner();
        _this.queries = (_a = props.value) !== null && _a !== void 0 ? _a : [];
        return _this;
    }
    QueryEditor.prototype.componentDidMount = function () {
        var _this = this;
        this.runner.get().subscribe(function (data) {
            _this.setState({ panelDataByRefId: data });
        });
    };
    QueryEditor.prototype.componentWillUnmount = function () {
        this.runner.destroy();
    };
    QueryEditor.prototype.renderAddQueryRow = function (styles) {
        return (React.createElement(HorizontalGroup, { spacing: "md", align: "flex-start" },
            React.createElement(Button, { type: "button", icon: "plus", onClick: this.onNewAlertingQuery, variant: "secondary", "aria-label": selectors.components.QueryTab.addQuery }, "Query"),
            config.expressionsEnabled && (React.createElement(Tooltip, { content: "Beta feature: queries could stop working in next version", placement: "right" },
                React.createElement(Button, { type: "button", icon: "plus", onClick: this.onNewExpressionQuery, variant: "secondary", className: styles.expressionButton },
                    React.createElement("span", null, "Expression\u00A0"),
                    React.createElement(Icon, { name: "exclamation-triangle", className: "muted", size: "sm" }))))));
    };
    QueryEditor.prototype.isRunning = function () {
        var data = Object.values(this.state.panelDataByRefId).find(function (d) { return Boolean(d); });
        return (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading;
    };
    QueryEditor.prototype.renderRunQueryButton = function () {
        var isRunning = this.isRunning();
        var styles = getStyles(config.theme2);
        if (isRunning) {
            return (React.createElement("div", { className: styles.runWrapper },
                React.createElement(Button, { icon: "fa fa-spinner", type: "button", variant: "destructive", onClick: this.onCancelQueries }, "Cancel")));
        }
        return (React.createElement("div", { className: styles.runWrapper },
            React.createElement(Button, { icon: "sync", type: "button", onClick: this.onRunQueries }, "Run queries")));
    };
    QueryEditor.prototype.render = function () {
        var _a = this.props.value, value = _a === void 0 ? [] : _a;
        var panelDataByRefId = this.state.panelDataByRefId;
        var styles = getStyles(config.theme2);
        return (React.createElement("div", { className: styles.container },
            React.createElement(QueryRows, { data: panelDataByRefId, queries: value, onQueriesChange: this.onChangeQueries, onDuplicateQuery: this.onDuplicateQuery, onRunQueries: this.onRunQueries }),
            this.renderAddQueryRow(styles),
            this.renderRunQueryButton()));
    };
    return QueryEditor;
}(PureComponent));
export { QueryEditor };
var addQuery = function (queries, queryToAdd) {
    var refId = getNextRefIdChar(queries);
    var query = __assign(__assign({}, queryToAdd), { refId: refId, queryType: '', model: __assign(__assign({}, queryToAdd.model), { hide: false, refId: refId }), relativeTimeRange: defaultTimeRange(queryToAdd.model) });
    return __spreadArray(__spreadArray([], __read(queries), false), [query], false);
};
var defaultTimeRange = function (model) {
    if (isExpressionQuery(model)) {
        return;
    }
    return getDefaultRelativeTimeRange();
};
var getStyles = stylesFactory(function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      background-color: ", ";\n      height: 100%;\n      max-width: ", "px;\n    "], ["\n      background-color: ", ";\n      height: 100%;\n      max-width: ", "px;\n    "])), theme.colors.background.primary, theme.breakpoints.values.xxl),
        runWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(1)),
        editorWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      border: 1px solid ", ";\n      border-radius: ", ";\n    "], ["\n      border: 1px solid ", ";\n      border-radius: ", ";\n    "])), theme.colors.border.medium, theme.shape.borderRadius()),
        expressionButton: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing(0.5)),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=QueryEditor.js.map