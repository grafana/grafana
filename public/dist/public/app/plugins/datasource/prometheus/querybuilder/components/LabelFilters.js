import { css, cx } from '@emotion/css';
import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { EditorFieldGroup, EditorField, EditorList } from '@grafana/experimental';
import { InlineFieldRow, InlineLabel } from '@grafana/ui';
import { LabelFilterItem } from './LabelFilterItem';
export const MISSING_LABEL_FILTER_ERROR_MESSAGE = 'Select at least 1 label filter (label and value)';
export function LabelFilters({ labelsFilters, onChange, onGetLabelNames, onGetLabelValues, labelFilterRequired, getLabelValuesAutofillSuggestions, debounceDuration, variableEditor, }) {
    const defaultOp = '=';
    const [items, setItems] = useState([{ op: defaultOp }]);
    useEffect(() => {
        if (labelsFilters.length > 0) {
            setItems(labelsFilters);
        }
        else {
            setItems([{ op: defaultOp }]);
        }
    }, [labelsFilters]);
    const onLabelsChange = (newItems) => {
        setItems(newItems);
        // Extract full label filters with both label & value
        const newLabels = newItems.filter((x) => x.label != null && x.value != null);
        if (!isEqual(newLabels, labelsFilters)) {
            onChange(newLabels);
        }
    };
    const hasLabelFilter = items.some((item) => item.label && item.value);
    const editorList = () => {
        return (React.createElement(EditorList, { items: items, onChange: onLabelsChange, renderItem: (item, onChangeItem, onDelete) => (React.createElement(LabelFilterItem, { debounceDuration: debounceDuration, item: item, defaultOp: defaultOp, onChange: onChangeItem, onDelete: onDelete, onGetLabelNames: onGetLabelNames, onGetLabelValues: onGetLabelValues, invalidLabel: labelFilterRequired && !item.label, invalidValue: labelFilterRequired && !item.value, getLabelValuesAutofillSuggestions: getLabelValuesAutofillSuggestions })) }));
    };
    return (React.createElement(React.Fragment, null, variableEditor ? (React.createElement(InlineFieldRow, null,
        React.createElement("div", { className: cx(css `
              display: flex;
            `) },
            React.createElement(InlineLabel, { width: 20, tooltip: React.createElement("div", null, "Optional: used to filter the metric select for this query type.") }, "Label filters"),
            editorList()))) : (React.createElement(EditorFieldGroup, null,
        React.createElement(EditorField, { label: "Label filters", error: MISSING_LABEL_FILTER_ERROR_MESSAGE, invalid: labelFilterRequired && !hasLabelFilter }, editorList())))));
}
//# sourceMappingURL=LabelFilters.js.map