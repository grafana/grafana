import { cloneDeep } from 'lodash';
import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { applyFieldOverrides, applyRawFieldOverrides, DataTransformerID, transformDataFrame, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, Spinner, Table } from '@grafana/ui';
import { config } from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { dataFrameToLogsModel } from '../logs/logsModel';
import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles } from './styles';
import { downloadAsJson, downloadDataFrameAsCsv, downloadLogsModelAsTxt, downloadTraceAsJson } from './utils/download';
export class InspectDataTab extends PureComponent {
    constructor(props) {
        var _a;
        super(props);
        this.onExportLogsAsTxt = () => {
            const { data, dataName, app } = this.props;
            reportInteraction('grafana_logs_download_logs_clicked', {
                app,
                format: 'logs',
                area: 'inspector',
            });
            const logsModel = dataFrameToLogsModel(data || []);
            downloadLogsModelAsTxt(logsModel, dataName);
        };
        this.onExportTracesAsJson = () => {
            var _a;
            const { data, dataName, app } = this.props;
            if (!data) {
                return;
            }
            for (const df of data) {
                // Only export traces
                if (((_a = df.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) !== 'trace') {
                    continue;
                }
                const traceFormat = downloadTraceAsJson(df, dataName + '-traces');
                reportInteraction('grafana_traces_download_traces_clicked', {
                    app,
                    grafana_version: config.buildInfo.version,
                    trace_format: traceFormat,
                    location: 'inspector',
                });
            }
        };
        this.onExportServiceGraph = () => {
            const { data, dataName, app } = this.props;
            reportInteraction('grafana_traces_download_service_graph_clicked', {
                app,
                grafana_version: config.buildInfo.version,
                location: 'inspector',
            });
            if (!data) {
                return;
            }
            downloadAsJson(data, dataName);
        };
        this.onDataFrameChange = (item) => {
            this.setState({
                transformId: item.value === DataTransformerID.joinByField ? DataTransformerID.joinByField : DataTransformerID.noop,
                dataFrameIndex: typeof item.value === 'number' ? item.value : 0,
                selectedDataFrame: item.value,
            });
        };
        this.onToggleDownloadForExcel = () => {
            this.setState((prevState) => ({
                downloadForExcel: !prevState.downloadForExcel,
            }));
        };
        this.state = {
            selectedDataFrame: 0,
            dataFrameIndex: 0,
            transformId: DataTransformerID.noop,
            transformationOptions: buildTransformationOptions(),
            transformedData: (_a = props.data) !== null && _a !== void 0 ? _a : [],
            downloadForExcel: false,
        };
    }
    componentDidUpdate(prevProps, prevState) {
        if (!this.props.data) {
            this.setState({ transformedData: [] });
            return;
        }
        if (this.props.options.withTransforms) {
            this.setState({ transformedData: this.props.data });
            return;
        }
        if (prevProps.data !== this.props.data || prevState.transformId !== this.state.transformId) {
            const currentTransform = this.state.transformationOptions.find((item) => item.value === this.state.transformId);
            if (currentTransform && currentTransform.transformer.id !== DataTransformerID.noop) {
                const selectedDataFrame = this.state.selectedDataFrame;
                const dataFrameIndex = this.state.dataFrameIndex;
                const subscription = transformDataFrame([currentTransform.transformer], this.props.data).subscribe((data) => {
                    this.setState({ transformedData: data, selectedDataFrame, dataFrameIndex }, () => subscription.unsubscribe());
                });
                return;
            }
            this.setState({ transformedData: this.props.data });
            return;
        }
    }
    exportCsv(dataFrames, hasLogs) {
        const { dataName } = this.props;
        const { transformId } = this.state;
        const dataFrame = dataFrames[this.state.dataFrameIndex];
        if (hasLogs) {
            reportInteraction('grafana_logs_download_clicked', { app: this.props.app, format: 'csv' });
        }
        downloadDataFrameAsCsv(dataFrame, dataName, { useExcelHeader: this.state.downloadForExcel }, transformId);
    }
    getProcessedData() {
        const { options, panelPluginId, fieldConfig, timeZone } = this.props;
        const data = this.state.transformedData;
        if (!options.withFieldConfig || !panelPluginId || !fieldConfig) {
            return applyRawFieldOverrides(data);
        }
        const fieldConfigCleaned = this.cleanTableConfigFromFieldConfig(panelPluginId, fieldConfig);
        // We need to apply field config as it's not done by PanelQueryRunner (even when withFieldConfig is true).
        // It's because transformers create new fields and data frames, and we need to clean field config of any table settings.
        return applyFieldOverrides({
            data,
            theme: config.theme2,
            fieldConfig: fieldConfigCleaned,
            timeZone,
            replaceVariables: (value) => {
                return value;
            },
        });
    }
    // Because we visualize this data in a table we have to remove any custom table display settings
    cleanTableConfigFromFieldConfig(panelPluginId, fieldConfig) {
        if (panelPluginId !== 'table') {
            return fieldConfig;
        }
        fieldConfig = cloneDeep(fieldConfig);
        // clear all table specific options
        fieldConfig.defaults.custom = {};
        // clear all table override properties
        for (const override of fieldConfig.overrides) {
            for (const prop of override.properties) {
                if (prop.id.startsWith('custom.')) {
                    const index = override.properties.indexOf(prop);
                    override.properties.slice(index, 1);
                }
            }
        }
        return fieldConfig;
    }
    renderActions(dataFrames, hasLogs, hasTraces, hasServiceGraph) {
        return (React.createElement(React.Fragment, null,
            React.createElement(Button, { variant: "primary", onClick: () => this.exportCsv(dataFrames, hasLogs), size: "sm" },
                React.createElement(Trans, { i18nKey: "dashboard.inspect-data.download-csv" }, "Download CSV")),
            hasLogs && (React.createElement(Button, { variant: "primary", onClick: this.onExportLogsAsTxt, size: "sm" },
                React.createElement(Trans, { i18nKey: "dashboard.inspect-data.download-logs" }, "Download logs"))),
            hasTraces && (React.createElement(Button, { variant: "primary", onClick: this.onExportTracesAsJson, size: "sm" },
                React.createElement(Trans, { i18nKey: "dashboard.inspect-data.download-traces" }, "Download traces"))),
            hasServiceGraph && (React.createElement(Button, { variant: "primary", onClick: this.onExportServiceGraph, size: "sm" },
                React.createElement(Trans, { i18nKey: "dashboard.inspect-data.download-service" }, "Download service graph")))));
    }
    render() {
        const { isLoading, options, data, onOptionsChange, hasTransformations } = this.props;
        const { dataFrameIndex, transformationOptions, selectedDataFrame, downloadForExcel } = this.state;
        const styles = getPanelInspectorStyles();
        if (isLoading) {
            return (React.createElement("div", null,
                React.createElement(Spinner, { inline: true }),
                " Loading"));
        }
        const dataFrames = this.getProcessedData();
        if (!dataFrames || !dataFrames.length) {
            return React.createElement("div", null, "No Data");
        }
        // let's make sure we don't try to render a frame that doesn't exists
        const index = !dataFrames[dataFrameIndex] ? 0 : dataFrameIndex;
        const dataFrame = dataFrames[index];
        const hasLogs = dataFrames.some((df) => { var _a; return ((_a = df === null || df === void 0 ? void 0 : df.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'logs'; });
        const hasTraces = dataFrames.some((df) => { var _a; return ((_a = df === null || df === void 0 ? void 0 : df.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'trace'; });
        const hasServiceGraph = dataFrames.some((df) => { var _a; return ((_a = df === null || df === void 0 ? void 0 : df.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'nodeGraph'; });
        return (React.createElement("div", { className: styles.wrap, "aria-label": selectors.components.PanelInspector.Data.content },
            React.createElement("div", { className: styles.toolbar },
                React.createElement(InspectDataOptions, { data: data, hasTransformations: hasTransformations, options: options, dataFrames: dataFrames, transformationOptions: transformationOptions, selectedDataFrame: selectedDataFrame, downloadForExcel: downloadForExcel, onOptionsChange: onOptionsChange, onDataFrameChange: this.onDataFrameChange, toggleDownloadForExcel: this.onToggleDownloadForExcel, actions: this.renderActions(dataFrames, hasLogs, hasTraces, hasServiceGraph) })),
            React.createElement("div", { className: styles.content },
                React.createElement(AutoSizer, null, ({ width, height }) => {
                    if (width === 0) {
                        return null;
                    }
                    return React.createElement(Table, { width: width, height: height, data: dataFrame, showTypeIcons: true });
                }))));
    }
}
function buildTransformationOptions() {
    const transformations = [
        {
            value: DataTransformerID.joinByField,
            label: t('dashboard.inspect-data.transformation', 'Series joined by time'),
            transformer: {
                id: DataTransformerID.joinByField,
                options: { byField: undefined }, // defaults to time field
            },
        },
    ];
    return transformations;
}
//# sourceMappingURL=InspectDataTab.js.map