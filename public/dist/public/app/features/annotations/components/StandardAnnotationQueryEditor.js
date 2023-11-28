import { __awaiter } from "tslib";
import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { lastValueFrom } from 'rxjs';
import { DataSourcePluginContextProvider, LoadingState, } from '@grafana/data';
import { Button, Icon, Spinner } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { PanelModel } from 'app/features/dashboard/state';
import { executeAnnotationQuery } from '../executeAnnotationQuery';
import { shouldUseLegacyRunner, shouldUseMappingUI, standardAnnotationSupport } from '../standardAnnotationSupport';
import { AnnotationFieldMapper } from './AnnotationResultMapper';
export default class StandardAnnotationQueryEditor extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {};
        this.onRunQuery = () => __awaiter(this, void 0, void 0, function* () {
            const { datasource, annotation } = this.props;
            if (shouldUseLegacyRunner(datasource)) {
                // In the new UI the running of query is done so the data can be mapped. In the legacy annotations this does
                // not exist as the annotationQuery already returns annotation events which cannot be mapped. This means that
                // right now running a query for data source with legacy runner does not make much sense.
                return;
            }
            const dashboard = getDashboardSrv().getCurrent();
            if (!dashboard) {
                return;
            }
            this.setState({
                running: true,
            });
            const response = yield lastValueFrom(executeAnnotationQuery({
                range: getTimeSrv().timeRange(),
                panel: new PanelModel({}),
                dashboard,
            }, datasource, annotation));
            this.setState({
                running: false,
                response,
            });
        });
        this.onQueryChange = (target) => {
            this.props.onChange(Object.assign(Object.assign({}, this.props.annotation), { target }));
        };
        this.onMappingChange = (mappings) => {
            this.props.onChange(Object.assign(Object.assign({}, this.props.annotation), { mappings }));
        };
        this.onAnnotationChange = (annotation) => {
            this.props.onChange(annotation);
        };
    }
    componentDidMount() {
        this.verifyDataSource();
    }
    componentDidUpdate(oldProps) {
        if (this.props.annotation !== oldProps.annotation && !shouldUseLegacyRunner(this.props.datasource)) {
            this.verifyDataSource();
        }
    }
    verifyDataSource() {
        const { datasource, annotation } = this.props;
        // Handle any migration issues
        const processor = Object.assign(Object.assign({}, standardAnnotationSupport), datasource.annotations);
        const fixed = processor.prepareAnnotation(annotation);
        if (fixed !== annotation) {
            this.props.onChange(fixed);
        }
        else {
            this.onRunQuery();
        }
    }
    renderStatus() {
        var _a, _b, _c, _d, _e;
        const { response, running } = this.state;
        let rowStyle = 'alert-info';
        let text = '...';
        let icon = undefined;
        if (running || ((_a = response === null || response === void 0 ? void 0 : response.panelData) === null || _a === void 0 ? void 0 : _a.state) === LoadingState.Loading || !response) {
            text = 'loading...';
        }
        else {
            const { events, panelData } = response;
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
                const frame = (_d = (_c = panelData === null || panelData === void 0 ? void 0 : panelData.series) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : (_e = panelData === null || panelData === void 0 ? void 0 : panelData.annotations) === null || _e === void 0 ? void 0 : _e[0];
                text = `${events.length} events (from ${frame === null || frame === void 0 ? void 0 : frame.fields.length} fields)`;
            }
        }
        return (React.createElement("div", { className: cx(rowStyle, css `
            margin: 4px 0px;
            padding: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          `) },
            React.createElement("div", null,
                icon && (React.createElement(React.Fragment, null,
                    React.createElement(Icon, { name: icon }),
                    "\u00A0")),
                text),
            React.createElement("div", null, running ? (React.createElement(Spinner, null)) : (React.createElement(Button, { variant: "secondary", size: "xs", onClick: this.onRunQuery }, "TEST")))));
    }
    render() {
        var _a, _b, _c, _d, _e;
        const { datasource, annotation, datasourceInstanceSettings } = this.props;
        const { response } = this.state;
        // Find the annotation runner
        let QueryEditor = ((_a = datasource.annotations) === null || _a === void 0 ? void 0 : _a.QueryEditor) || ((_b = datasource.components) === null || _b === void 0 ? void 0 : _b.QueryEditor);
        if (!QueryEditor) {
            return React.createElement("div", null, "Annotations are not supported. This datasource needs to export a QueryEditor");
        }
        const query = Object.assign(Object.assign({}, (_d = (_c = datasource.annotations) === null || _c === void 0 ? void 0 : _c.getDefaultQuery) === null || _d === void 0 ? void 0 : _d.call(_c)), ((_e = annotation.target) !== null && _e !== void 0 ? _e : { refId: 'Anno' }));
        return (React.createElement(React.Fragment, null,
            React.createElement(DataSourcePluginContextProvider, { instanceSettings: datasourceInstanceSettings },
                React.createElement(QueryEditor, { key: datasource === null || datasource === void 0 ? void 0 : datasource.name, query: query, datasource: datasource, onChange: this.onQueryChange, onRunQuery: this.onRunQuery, data: response === null || response === void 0 ? void 0 : response.panelData, range: getTimeSrv().timeRange(), annotation: annotation, onAnnotationChange: this.onAnnotationChange })),
            shouldUseMappingUI(datasource) && (React.createElement(React.Fragment, null,
                this.renderStatus(),
                React.createElement(AnnotationFieldMapper, { response: response, mappings: annotation.mappings, change: this.onMappingChange })))));
    }
}
//# sourceMappingURL=StandardAnnotationQueryEditor.js.map