import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { EditorFieldGroup, EditorField, EditorList } from '@grafana/experimental';
import { LabelFilterItem } from './LabelFilterItem';
export const MISSING_LABEL_FILTER_ERROR_MESSAGE = 'Select at least 1 label filter (label and value)';
export function LabelFilters({ labelsFilters, onChange, onGetLabelNames, onGetLabelValues, labelFilterRequired, }) {
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
    return (React.createElement(EditorFieldGroup, null,
        React.createElement(EditorField, { label: "Label filters", error: MISSING_LABEL_FILTER_ERROR_MESSAGE, invalid: labelFilterRequired && !hasLabelFilter },
            React.createElement(EditorList, { items: items, onChange: onLabelsChange, renderItem: (item, onChangeItem, onDelete) => (React.createElement(LabelFilterItem, { item: item, items: items, defaultOp: defaultOp, onChange: onChangeItem, onDelete: onDelete, onGetLabelNames: onGetLabelNames, onGetLabelValues: onGetLabelValues, invalidLabel: labelFilterRequired && !item.label, invalidValue: labelFilterRequired && !item.value })) }))));
}
//# sourceMappingURL=LabelFilters.js.map