import { __assign, __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { lastValueFrom } from 'rxjs';
import { css, cx } from '@emotion/css';
import { LoadingState } from '@grafana/data';
import { Button, Icon, Spinner } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { standardAnnotationSupport } from '../standardAnnotationSupport';
import { executeAnnotationQuery } from '../annotations_srv';
import { AnnotationFieldMapper } from './AnnotationResultMapper';
import coreModule from 'app/core/core_module';
var StandardAnnotationQueryEditor = /** @class */ (function (_super) {
    __extends(StandardAnnotationQueryEditor, _super);
    function StandardAnnotationQueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {};
        _this.onRunQuery = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, datasource, annotation, dashboard, response;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, datasource = _a.datasource, annotation = _a.annotation;
                        dashboard = getDashboardSrv().getCurrent();
                        if (!dashboard) {
                            return [2 /*return*/];
                        }
                        this.setState({
                            running: true,
                        });
                        return [4 /*yield*/, lastValueFrom(executeAnnotationQuery({
                                range: getTimeSrv().timeRange(),
                                panel: {},
                                dashboard: dashboard,
                            }, datasource, annotation))];
                    case 1:
                        response = _b.sent();
                        this.setState({
                            running: false,
                            response: response,
                        });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.onQueryChange = function (target) {
            _this.props.onChange(__assign(__assign({}, _this.props.annotation), { target: target }));
        };
        _this.onMappingChange = function (mappings) {
            _this.props.onChange(__assign(__assign({}, _this.props.annotation), { mappings: mappings }));
        };
        return _this;
    }
    StandardAnnotationQueryEditor.prototype.componentDidMount = function () {
        this.verifyDataSource();
    };
    StandardAnnotationQueryEditor.prototype.componentDidUpdate = function (oldProps) {
        if (this.props.annotation !== oldProps.annotation) {
            this.verifyDataSource();
        }
    };
    StandardAnnotationQueryEditor.prototype.verifyDataSource = function () {
        var _a = this.props, datasource = _a.datasource, annotation = _a.annotation;
        // Handle any migration issues
        var processor = __assign(__assign({}, standardAnnotationSupport), datasource.annotations);
        var fixed = processor.prepareAnnotation(annotation);
        if (fixed !== annotation) {
            this.props.onChange(fixed);
        }
        else {
            this.onRunQuery();
        }
    };
    StandardAnnotationQueryEditor.prototype.renderStatus = function () {
        var _a, _b;
        var _c = this.state, response = _c.response, running = _c.running;
        var rowStyle = 'alert-info';
        var text = '...';
        var icon = undefined;
        if (running || ((_a = response === null || response === void 0 ? void 0 : response.panelData) === null || _a === void 0 ? void 0 : _a.state) === LoadingState.Loading || !response) {
            text = 'loading...';
        }
        else {
            var events = response.events, panelData = response.panelData;
            if (panelData === null || panelData === void 0 ? void 0 : panelData.error) {
                rowStyle = 'alert-error';
                icon = 'exclamation-triangle';
                text = (_b = panelData.error.message) !== null && _b !== void 0 ? _b : 'error';
            }
            else if (!(events === null || events === void 0 ? void 0 : events.length)) {
                rowStyle = 'alert-warning';
                icon = 'exclamation-triangle';
                text = 'No events found';
            }
            else {
                var frame = panelData === null || panelData === void 0 ? void 0 : panelData.series[0];
                text = events.length + " events (from " + (frame === null || frame === void 0 ? void 0 : frame.fields.length) + " fields)";
            }
        }
        return (React.createElement("div", { className: cx(rowStyle, css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            margin: 4px 0px;\n            padding: 4px;\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n          "], ["\n            margin: 4px 0px;\n            padding: 4px;\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n          "])))) },
            React.createElement("div", null,
                icon && (React.createElement(React.Fragment, null,
                    React.createElement(Icon, { name: icon }),
                    "\u00A0")),
                text),
            React.createElement("div", null, running ? (React.createElement(Spinner, null)) : (React.createElement(Button, { variant: "secondary", size: "xs", onClick: this.onRunQuery }, "TEST")))));
    };
    StandardAnnotationQueryEditor.prototype.render = function () {
        var _a, _b, _c;
        var _d = this.props, datasource = _d.datasource, annotation = _d.annotation;
        var response = this.state.response;
        // Find the annotaiton runner
        var QueryEditor = ((_a = datasource.annotations) === null || _a === void 0 ? void 0 : _a.QueryEditor) || ((_b = datasource.components) === null || _b === void 0 ? void 0 : _b.QueryEditor);
        if (!QueryEditor) {
            return React.createElement("div", null, "Annotations are not supported. This datasource needs to export a QueryEditor");
        }
        var query = (_c = annotation.target) !== null && _c !== void 0 ? _c : { refId: 'Anno' };
        return (React.createElement(React.Fragment, null,
            React.createElement(QueryEditor, { key: datasource === null || datasource === void 0 ? void 0 : datasource.name, query: query, datasource: datasource, onChange: this.onQueryChange, onRunQuery: this.onRunQuery, data: response === null || response === void 0 ? void 0 : response.panelData, range: getTimeSrv().timeRange() }),
            datasource.type !== 'datasource' && (React.createElement(React.Fragment, null,
                this.renderStatus(),
                React.createElement(AnnotationFieldMapper, { response: response, mappings: annotation.mappings, change: this.onMappingChange })))));
    };
    return StandardAnnotationQueryEditor;
}(PureComponent));
export default StandardAnnotationQueryEditor;
// Careful to use a unique directive name!  many plugins already use "annotationEditor" and have conflicts
coreModule.directive('standardAnnotationEditor', [
    'reactDirective',
    function (reactDirective) {
        return reactDirective(StandardAnnotationQueryEditor, ['annotation', 'datasource', 'change']);
    },
]);
var templateObject_1;
//# sourceMappingURL=StandardAnnotationQueryEditor.js.map