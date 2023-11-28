import { __rest } from "tslib";
import React from 'react';
import { EditorField } from '@grafana/experimental';
import { InlineField } from '@grafana/ui';
const DEFAULT_LABEL_WIDTH = 18;
export const Field = (props) => {
    const { labelWidth, inlineField } = props, remainingProps = __rest(props, ["labelWidth", "inlineField"]);
    if (!inlineField) {
        return React.createElement(EditorField, Object.assign({ width: labelWidth || DEFAULT_LABEL_WIDTH }, remainingProps));
    }
    else {
        return React.createElement(InlineField, Object.assign({ labelWidth: labelWidth || DEFAULT_LABEL_WIDTH }, remainingProps));
    }
};
//# sourceMappingURL=Field.js.map