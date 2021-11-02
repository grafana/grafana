import { __extends, __makeTemplateObject, __values } from "tslib";
import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { applyFieldOverrides, applyRawFieldOverrides, DataTransformerID, dateTimeFormat, dateTimeFormatISO, MutableDataFrame, toCSV, transformDataFrame, } from '@grafana/data';
import { Button, Container, Spinner, Table } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { InspectDataOptions } from './InspectDataOptions';
import { getPanelInspectorStyles } from './styles';
import { config } from 'app/core/config';
import { saveAs } from 'file-saver';
import { css } from '@emotion/css';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { transformToJaeger } from 'app/plugins/datasource/jaeger/responseTransform';
import { transformToZipkin } from 'app/plugins/datasource/zipkin/utils/transforms';
import { transformToOTLP } from 'app/plugins/datasource/tempo/resultTransformer';
var InspectDataTab = /** @class */ (function (_super) {
    __extends(InspectDataTab, _super);
    function InspectDataTab(props) {
        var _a;
        var _this = _super.call(this, props) || this;
        _this.exportCsv = function (dataFrame, csvConfig) {
            if (csvConfig === void 0) { csvConfig = {}; }
            var panel = _this.props.panel;
            var transformId = _this.state.transformId;
            var dataFrameCsv = toCSV([dataFrame], csvConfig);
            var blob = new Blob([String.fromCharCode(0xfeff), dataFrameCsv], {
                type: 'text/csv;charset=utf-8',
            });
            var displayTitle = panel ? panel.getDisplayTitle() : 'Explore';
            var transformation = transformId !== DataTransformerID.noop ? '-as-' + transformId.toLocaleLowerCase() : '';
            var fileName = displayTitle + "-data" + transformation + "-" + dateTimeFormat(new Date()) + ".csv";
            saveAs(blob, fileName);
        };
        _this.exportLogsAsTxt = function () {
            var _a;
            var _b = _this.props, data = _b.data, panel = _b.panel;
            var logsModel = dataFrameToLogsModel(data || [], undefined);
            var textToDownload = '';
            (_a = logsModel.meta) === null || _a === void 0 ? void 0 : _a.forEach(function (metaItem) {
                var string = metaItem.label + ": " + JSON.stringify(metaItem.value) + "\n";
                textToDownload = textToDownload + string;
            });
            textToDownload = textToDownload + '\n\n';
            logsModel.rows.forEach(function (row) {
                var newRow = dateTimeFormatISO(row.timeEpochMs) + '\t' + row.entry + '\n';
                textToDownload = textToDownload + newRow;
            });
            var blob = new Blob([textToDownload], {
                type: 'text/plain;charset=utf-8',
            });
            var displayTitle = panel ? panel.getDisplayTitle() : 'Explore';
            var fileName = displayTitle + "-logs-" + dateTimeFormat(new Date()) + ".txt";
            saveAs(blob, fileName);
        };
        _this.exportTracesAsJson = function () {
            var e_1, _a;
            var _b, _c, _d;
            var _e = _this.props, data = _e.data, panel = _e.panel;
            if (!data) {
                return;
            }
            try {
                for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                    var df = data_1_1.value;
                    // Only export traces
                    if (((_b = df.meta) === null || _b === void 0 ? void 0 : _b.preferredVisualisationType) !== 'trace') {
                        continue;
                    }
                    switch ((_d = (_c = df.meta) === null || _c === void 0 ? void 0 : _c.custom) === null || _d === void 0 ? void 0 : _d.traceFormat) {
                        case 'jaeger': {
                            var res = transformToJaeger(new MutableDataFrame(df));
                            _this.saveTraceJson(res, panel);
                            break;
                        }
                        case 'zipkin': {
                            var res = transformToZipkin(new MutableDataFrame(df));
                            _this.saveTraceJson(res, panel);
                            break;
                        }
                        case 'otlp':
                        default: {
                            var res = transformToOTLP(new MutableDataFrame(df));
                            _this.saveTraceJson(res, panel);
                            break;
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        _this.saveTraceJson = function (json, panel) {
            var blob = new Blob([JSON.stringify(json)], {
                type: 'application/json',
            });
            var displayTitle = panel ? panel.getDisplayTitle() : 'Explore';
            var fileName = displayTitle + "-traces-" + dateTimeFormat(new Date()) + ".json";
            saveAs(blob, fileName);
        };
        _this.onDataFrameChange = function (item) {
            _this.setState({
                transformId: item.value === DataTransformerID.seriesToColumns ? DataTransformerID.seriesToColumns : DataTransformerID.noop,
                dataFrameIndex: typeof item.value === 'number' ? item.value : 0,
                selectedDataFrame: item.value,
            });
        };
        _this.toggleDownloadForExcel = function () {
            _this.setState(function (prevState) { return ({
                downloadForExcel: !prevState.downloadForExcel,
            }); });
        };
        _this.state = {
            selectedDataFrame: 0,
            dataFrameIndex: 0,
            transformId: DataTransformerID.noop,
            transformationOptions: buildTransformationOptions(),
            transformedData: (_a = props.data) !== null && _a !== void 0 ? _a : [],
            downloadForExcel: false,
        };
        return _this;
    }
    InspectDataTab.prototype.componentDidUpdate = function (prevProps, prevState) {
        var _this = this;
        if (!this.props.data) {
            this.setState({ transformedData: [] });
            return;
        }
        if (this.props.options.withTransforms) {
            this.setState({ transformedData: this.props.data });
            return;
        }
        if (prevProps.data !== this.props.data || prevState.transformId !== this.state.transformId) {
            var currentTransform = this.state.transformationOptions.find(function (item) { return item.value === _this.state.transformId; });
            if (currentTransform && currentTransform.transformer.id !== DataTransformerID.noop) {
                var selectedDataFrame_1 = this.state.selectedDataFrame;
                var dataFrameIndex_1 = this.state.dataFrameIndex;
                var subscription_1 = transformDataFrame([currentTransform.transformer], this.props.data).subscribe(function (data) {
                    _this.setState({ transformedData: data, selectedDataFrame: selectedDataFrame_1, dataFrameIndex: dataFrameIndex_1 }, function () { return subscription_1.unsubscribe(); });
                });
                return;
            }
            this.setState({ transformedData: this.props.data });
            return;
        }
    };
    InspectDataTab.prototype.getProcessedData = function () {
        var _a = this.props, options = _a.options, panel = _a.panel;
        var data = this.state.transformedData;
        if (!options.withFieldConfig || !panel) {
            return applyRawFieldOverrides(data);
        }
        // We need to apply field config even though it was already applied in the PanelQueryRunner.
        // That's because transformers create new fields and data frames, so i.e. display processor is no longer there
        return applyFieldOverrides({
            data: data,
            theme: config.theme2,
            fieldConfig: panel.fieldConfig,
            replaceVariables: function (value) {
                return value;
            },
        });
    };
    InspectDataTab.prototype.render = function () {
        var _this = this;
        var _a = this.props, isLoading = _a.isLoading, options = _a.options, data = _a.data, panel = _a.panel, onOptionsChange = _a.onOptionsChange;
        var _b = this.state, dataFrameIndex = _b.dataFrameIndex, transformId = _b.transformId, transformationOptions = _b.transformationOptions, selectedDataFrame = _b.selectedDataFrame, downloadForExcel = _b.downloadForExcel;
        var styles = getPanelInspectorStyles();
        if (isLoading) {
            return (React.createElement("div", null,
                React.createElement(Spinner, { inline: true }),
                " Loading"));
        }
        var dataFrames = this.getProcessedData();
        if (!dataFrames || !dataFrames.length) {
            return React.createElement("div", null, "No Data");
        }
        // let's make sure we don't try to render a frame that doesn't exists
        var index = !dataFrames[dataFrameIndex] ? 0 : dataFrameIndex;
        var dataFrame = dataFrames[index];
        var hasLogs = dataFrames.some(function (df) { var _a; return ((_a = df === null || df === void 0 ? void 0 : df.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'logs'; });
        var hasTraces = dataFrames.some(function (df) { var _a; return ((_a = df === null || df === void 0 ? void 0 : df.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'trace'; });
        return (React.createElement("div", { className: styles.dataTabContent, "aria-label": selectors.components.PanelInspector.Data.content },
            React.createElement("div", { className: styles.actionsWrapper },
                React.createElement(InspectDataOptions, { data: data, panel: panel, options: options, dataFrames: dataFrames, transformId: transformId, transformationOptions: transformationOptions, selectedDataFrame: selectedDataFrame, downloadForExcel: downloadForExcel, onOptionsChange: onOptionsChange, onDataFrameChange: this.onDataFrameChange, toggleDownloadForExcel: this.toggleDownloadForExcel }),
                React.createElement(Button, { variant: "primary", onClick: function () { return _this.exportCsv(dataFrames[dataFrameIndex], { useExcelHeader: _this.state.downloadForExcel }); }, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              margin-bottom: 10px;\n            "], ["\n              margin-bottom: 10px;\n            "]))) }, "Download CSV"),
                hasLogs && (React.createElement(Button, { variant: "primary", onClick: this.exportLogsAsTxt, className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n                margin-bottom: 10px;\n                margin-left: 10px;\n              "], ["\n                margin-bottom: 10px;\n                margin-left: 10px;\n              "]))) }, "Download logs")),
                hasTraces && (React.createElement(Button, { variant: "primary", onClick: this.exportTracesAsJson, className: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n                margin-bottom: 10px;\n                margin-left: 10px;\n              "], ["\n                margin-bottom: 10px;\n                margin-left: 10px;\n              "]))) }, "Download traces"))),
            React.createElement(Container, { grow: 1 },
                React.createElement(AutoSizer, null, function (_a) {
                    var width = _a.width, height = _a.height;
                    if (width === 0) {
                        return null;
                    }
                    return (React.createElement("div", { style: { width: width, height: height } },
                        React.createElement(Table, { width: width, height: height, data: dataFrame, showTypeIcons: true })));
                }))));
    };
    return InspectDataTab;
}(PureComponent));
export { InspectDataTab };
function buildTransformationOptions() {
    var transformations = [
        {
            value: DataTransformerID.seriesToColumns,
            label: 'Series joined by time',
            transformer: {
                id: DataTransformerID.seriesToColumns,
                options: { byField: 'Time' },
            },
        },
    ];
    return transformations;
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=InspectDataTab.js.map