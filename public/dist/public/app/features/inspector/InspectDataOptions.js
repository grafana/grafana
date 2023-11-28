import React from 'react';
import { DataTransformerID, getFrameDisplayName } from '@grafana/data';
import { Field, HorizontalGroup, Select, Switch, VerticalGroup, useStyles2 } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { t } from 'app/core/internationalization';
import { DetailText } from 'app/features/inspector/DetailText';
import { getPanelInspectorStyles2 } from './styles';
export const InspectDataOptions = ({ options, actions, onOptionsChange, hasTransformations, data, dataFrames, transformationOptions, selectedDataFrame, onDataFrameChange, downloadForExcel, toggleDownloadForExcel, }) => {
    const styles = useStyles2(getPanelInspectorStyles2);
    let dataSelect = dataFrames;
    if (selectedDataFrame === DataTransformerID.joinByField) {
        dataSelect = data;
    }
    const choices = dataSelect.map((frame, index) => {
        return {
            value: index,
            label: `${getFrameDisplayName(frame)} (${index})`,
        };
    });
    const selectableOptions = [...transformationOptions, ...choices];
    function getActiveString() {
        let activeString = '';
        if (!data) {
            return activeString;
        }
        const parts = [];
        if (selectedDataFrame === DataTransformerID.joinByField) {
            parts.push(t('dashboard.inspect-data.series-to-columns', 'Series joined by time'));
        }
        else if (data.length > 1) {
            parts.push(getFrameDisplayName(data[selectedDataFrame]));
        }
        if (options.withTransforms || options.withFieldConfig) {
            if (options.withTransforms) {
                parts.push(t('dashboard.inspect-data.panel-transforms', 'Panel transforms'));
            }
            if (options.withTransforms && options.withFieldConfig) {
            }
            if (options.withFieldConfig) {
                parts.push(t('dashboard.inspect-data.formatted', 'Formatted data'));
            }
        }
        if (downloadForExcel) {
            parts.push(t('dashboard.inspect-data.excel-header', 'Excel header'));
        }
        return parts.join(', ');
    }
    return (React.createElement("div", { className: styles.dataDisplayOptions },
        React.createElement(QueryOperationRow, { id: "Data options", index: 0, title: t('dashboard.inspect-data.data-options', 'Data options'), headerElement: React.createElement(DetailText, null, getActiveString()), isOpen: false, actions: actions },
            React.createElement("div", { className: styles.options, "data-testid": "dataOptions" },
                React.createElement(VerticalGroup, { spacing: "none" },
                    data.length > 1 && (React.createElement(Field, { label: t('dashboard.inspect-data.dataframe-label', 'Show data frame') },
                        React.createElement(Select, { options: selectableOptions, value: selectedDataFrame, onChange: onDataFrameChange, width: 30, "aria-label": t('dashboard.inspect-data.dataframe-aria-label', 'Select dataframe') }))),
                    React.createElement(HorizontalGroup, null,
                        hasTransformations && onOptionsChange && (React.createElement(Field, { label: t('dashboard.inspect-data.transformations-label', 'Apply panel transformations'), description: t('dashboard.inspect-data.transformations-description', 'Table data is displayed with transformations defined in the panel Transform tab.') },
                            React.createElement(Switch, { value: !!options.withTransforms, onChange: () => onOptionsChange(Object.assign(Object.assign({}, options), { withTransforms: !options.withTransforms })) }))),
                        onOptionsChange && (React.createElement(Field, { label: t('dashboard.inspect-data.formatted-data-label', 'Formatted data'), description: t('dashboard.inspect-data.formatted-data-description', 'Table data is formatted with options defined in the Field and Override tabs.') },
                            React.createElement(Switch, { id: "formatted-data-toggle", value: !!options.withFieldConfig, onChange: () => onOptionsChange(Object.assign(Object.assign({}, options), { withFieldConfig: !options.withFieldConfig })) }))),
                        React.createElement(Field, { label: t('dashboard.inspect-data.download-excel-label', 'Download for Excel'), description: t('dashboard.inspect-data.download-excel-description', 'Adds header to CSV for use with Excel') },
                            React.createElement(Switch, { id: "excel-toggle", value: downloadForExcel, onChange: toggleDownloadForExcel }))))))));
};
//# sourceMappingURL=InspectDataOptions.js.map