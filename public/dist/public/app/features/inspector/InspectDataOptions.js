import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { DataTransformerID, getFrameDisplayName } from '@grafana/data';
import { Field, HorizontalGroup, Select, Switch, VerticalGroup } from '@grafana/ui';
import { getPanelInspectorStyles } from './styles';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { DetailText } from 'app/features/inspector/DetailText';
export var InspectDataOptions = function (_a) {
    var _b;
    var options = _a.options, onOptionsChange = _a.onOptionsChange, panel = _a.panel, data = _a.data, dataFrames = _a.dataFrames, transformId = _a.transformId, transformationOptions = _a.transformationOptions, selectedDataFrame = _a.selectedDataFrame, onDataFrameChange = _a.onDataFrameChange, downloadForExcel = _a.downloadForExcel, toggleDownloadForExcel = _a.toggleDownloadForExcel;
    var styles = getPanelInspectorStyles();
    var panelTransformations = panel === null || panel === void 0 ? void 0 : panel.getTransformations();
    var showPanelTransformationsOption = Boolean(panelTransformations === null || panelTransformations === void 0 ? void 0 : panelTransformations.length) && transformId !== 'join by time';
    var showFieldConfigsOption = panel && !((_b = panel.plugin) === null || _b === void 0 ? void 0 : _b.fieldConfigRegistry.isEmpty());
    var dataSelect = dataFrames;
    if (selectedDataFrame === DataTransformerID.seriesToColumns) {
        dataSelect = data;
    }
    var choices = dataSelect.map(function (frame, index) {
        return {
            value: index,
            label: getFrameDisplayName(frame) + " (" + index + ")",
        };
    });
    var selectableOptions = __spreadArray(__spreadArray([], __read(transformationOptions), false), __read(choices), false);
    function getActiveString() {
        var activeString = '';
        if (!data) {
            return activeString;
        }
        var parts = [];
        if (selectedDataFrame === DataTransformerID.seriesToColumns) {
            parts.push('Series joined by time');
        }
        else if (data.length > 1) {
            parts.push(getFrameDisplayName(data[selectedDataFrame]));
        }
        if (options.withTransforms || options.withFieldConfig) {
            if (options.withTransforms) {
                parts.push('Panel transforms');
            }
            if (options.withTransforms && options.withFieldConfig) {
            }
            if (options.withFieldConfig) {
                parts.push('Formatted data');
            }
        }
        if (downloadForExcel) {
            parts.push('Excel header');
        }
        return parts.join(', ');
    }
    return (React.createElement("div", { className: styles.dataDisplayOptions },
        React.createElement(QueryOperationRow, { id: "Data options", index: 0, title: "Data options", headerElement: React.createElement(DetailText, null, getActiveString()), isOpen: false },
            React.createElement("div", { className: styles.options, "data-testid": "dataOptions" },
                React.createElement(VerticalGroup, { spacing: "none" },
                    data.length > 1 && (React.createElement(Field, { label: "Show data frame" },
                        React.createElement(Select, { menuShouldPortal: true, options: selectableOptions, value: selectedDataFrame, onChange: onDataFrameChange, width: 30, "aria-label": "Select dataframe" }))),
                    React.createElement(HorizontalGroup, null,
                        showPanelTransformationsOption && onOptionsChange && (React.createElement(Field, { label: "Apply panel transformations", description: "Table data is displayed with transformations defined in the panel Transform tab." },
                            React.createElement(Switch, { value: !!options.withTransforms, onChange: function () { return onOptionsChange(__assign(__assign({}, options), { withTransforms: !options.withTransforms })); } }))),
                        showFieldConfigsOption && onOptionsChange && (React.createElement(Field, { label: "Formatted data", description: "Table data is formatted with options defined in the Field and Override tabs." },
                            React.createElement(Switch, { value: !!options.withFieldConfig, onChange: function () { return onOptionsChange(__assign(__assign({}, options), { withFieldConfig: !options.withFieldConfig })); } }))),
                        React.createElement(Field, { label: "Download for Excel", description: "Adds header to CSV for use with Excel" },
                            React.createElement(Switch, { value: downloadForExcel, onChange: toggleDownloadForExcel }))))))));
};
//# sourceMappingURL=InspectDataOptions.js.map