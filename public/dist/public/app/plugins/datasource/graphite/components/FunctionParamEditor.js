import { css } from '@emotion/css';
import React from 'react';
import { Segment, SegmentInput, useStyles2 } from '@grafana/ui';
/**
 * Render a function parameter with a segment dropdown for multiple options or simple input.
 */
export function FunctionParamEditor({ editableParam, onChange, onExpandedChange, autofocus }) {
    var _a;
    const styles = useStyles2(getStyles);
    if (((_a = editableParam.options) === null || _a === void 0 ? void 0 : _a.length) > 0) {
        return (React.createElement(Segment, { autofocus: autofocus, value: editableParam.value, inputPlaceholder: editableParam.name, className: styles.segment, options: editableParam.options, placeholder: ' +' + editableParam.name, onChange: (value) => {
                onChange(value.value || '');
            }, onExpandedChange: onExpandedChange, inputMinWidth: 150, allowCustomValue: true, allowEmptyValue: true }));
    }
    else {
        return (React.createElement(SegmentInput, { autofocus: autofocus, className: styles.input, value: editableParam.value || '', placeholder: ' +' + editableParam.name, inputPlaceholder: editableParam.name, onChange: (value) => {
                onChange(value.toString());
            }, onExpandedChange: onExpandedChange, 
            // input style
            style: { height: '25px', paddingTop: '2px', marginTop: '2px', paddingLeft: '4px', minWidth: '100px' } }));
    }
}
const getStyles = (theme) => ({
    segment: css({
        margin: 0,
        padding: 0,
    }),
    input: css `
    margin: 0;
    padding: 0;
    input {
      height: 25px;
    },
  `,
});
//# sourceMappingURL=FunctionParamEditor.js.map