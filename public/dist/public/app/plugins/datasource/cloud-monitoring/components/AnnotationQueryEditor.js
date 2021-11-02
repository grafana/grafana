import { __assign, __awaiter, __extends, __generator } from "tslib";
import React from 'react';
import { LegacyForms } from '@grafana/ui';
import { AnnotationsHelp, LabelFilter, Metrics, Project, QueryEditorRow } from './';
import { toOption } from '../functions';
import { EditorMode, MetricKind } from '../types';
var Input = LegacyForms.Input;
var DefaultTarget = {
    editorMode: EditorMode.Visual,
    projectName: '',
    projects: [],
    metricType: '',
    filters: [],
    metricKind: MetricKind.GAUGE,
    valueType: '',
    refId: 'annotationQuery',
    title: '',
    text: '',
    labels: {},
    variableOptionGroup: {},
    variableOptions: [],
};
var AnnotationQueryEditor = /** @class */ (function (_super) {
    __extends(AnnotationQueryEditor, _super);
    function AnnotationQueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = DefaultTarget;
        _this.onMetricTypeChange = function (_a) {
            var valueType = _a.valueType, metricKind = _a.metricKind, type = _a.type, unit = _a.unit;
            var _b = _this.props, onQueryChange = _b.onQueryChange, datasource = _b.datasource;
            _this.setState({
                metricType: type,
                unit: unit,
                valueType: valueType,
                metricKind: metricKind,
            }, function () {
                onQueryChange(_this.state);
            });
            datasource.getLabels(type, _this.state.refId, _this.state.projectName).then(function (labels) { return _this.setState({ labels: labels }); });
        };
        return _this;
    }
    AnnotationQueryEditor.prototype.UNSAFE_componentWillMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, target, datasource, variableOptionGroup, projects;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, target = _a.target, datasource = _a.datasource;
                        if (!target.projectName) {
                            target.projectName = datasource.getDefaultProject();
                        }
                        variableOptionGroup = {
                            label: 'Template Variables',
                            options: datasource.getVariables().map(toOption),
                        };
                        return [4 /*yield*/, datasource.getProjects()];
                    case 1:
                        projects = _b.sent();
                        this.setState(__assign(__assign({ variableOptionGroup: variableOptionGroup, variableOptions: variableOptionGroup.options }, target), { projects: projects }));
                        datasource
                            .getLabels(target.metricType, target.projectName, target.refId)
                            .then(function (labels) { return _this.setState({ labels: labels }); });
                        return [2 /*return*/];
                }
            });
        });
    };
    AnnotationQueryEditor.prototype.onChange = function (prop, value) {
        var _a;
        var _this = this;
        this.setState((_a = {}, _a[prop] = value, _a), function () {
            _this.props.onQueryChange(_this.state);
        });
    };
    AnnotationQueryEditor.prototype.render = function () {
        var _this = this;
        var _a = this.state, metricType = _a.metricType, projectName = _a.projectName, filters = _a.filters, title = _a.title, text = _a.text, variableOptionGroup = _a.variableOptionGroup, labels = _a.labels, variableOptions = _a.variableOptions;
        var datasource = this.props.datasource;
        return (React.createElement(React.Fragment, null,
            React.createElement(Project, { templateVariableOptions: variableOptions, datasource: datasource, projectName: projectName || datasource.getDefaultProject(), onChange: function (value) { return _this.onChange('projectName', value); } }),
            React.createElement(Metrics, { projectName: projectName, metricType: metricType, templateSrv: datasource.templateSrv, datasource: datasource, templateVariableOptions: variableOptions, onChange: function (metric) { return _this.onMetricTypeChange(metric); } }, function (metric) { return (React.createElement(React.Fragment, null,
                React.createElement(LabelFilter, { labels: labels, filters: filters, onChange: function (value) { return _this.onChange('filters', value); }, variableOptionGroup: variableOptionGroup }))); }),
            React.createElement(QueryEditorRow, { label: "Title" },
                React.createElement(Input, { type: "text", className: "gf-form-input width-20", value: title, onChange: function (e) { return _this.onChange('title', e.target.value); } })),
            React.createElement(QueryEditorRow, { label: "Text" },
                React.createElement(Input, { type: "text", className: "gf-form-input width-20", value: text, onChange: function (e) { return _this.onChange('text', e.target.value); } })),
            React.createElement(AnnotationsHelp, null)));
    };
    return AnnotationQueryEditor;
}(React.Component));
export { AnnotationQueryEditor };
//# sourceMappingURL=AnnotationQueryEditor.js.map