import React, { useCallback } from 'react';
import { FrameMatcherID } from '@grafana/data';
import { RefIDPicker } from '@grafana/ui/src/components/MatchersUI/FieldsByFrameRefIdMatcher';
export const FrameSelectionEditor = ({ value, context, onChange }) => {
    const onFilterChange = useCallback((v) => {
        onChange((v === null || v === void 0 ? void 0 : v.length)
            ? {
                id: FrameMatcherID.byRefId,
                options: v,
            }
            : undefined);
    }, [onChange]);
    return (React.createElement(RefIDPicker, { value: value === null || value === void 0 ? void 0 : value.options, onChange: onFilterChange, data: context.data, placeholder: "Change filter" }));
};
//# sourceMappingURL=FrameSelectionEditor.js.map