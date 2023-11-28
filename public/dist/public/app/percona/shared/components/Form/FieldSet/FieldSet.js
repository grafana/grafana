import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React from 'react';
import { useStyles, FieldSet as GrafanaFieldSet, CollapsableSection } from '@grafana/ui';
import { getStyles } from './FieldSet.styles';
const FieldSet = (_a) => {
    var { children, label, collapsableProps } = _a, props = __rest(_a, ["children", "label", "collapsableProps"]);
    const style = useStyles(getStyles);
    return collapsableProps ? (React.createElement(CollapsableSection, Object.assign({}, collapsableProps, { label: label, className: cx(style.collapsedSectionWrapper, collapsableProps.className) }),
        React.createElement(GrafanaFieldSet, Object.assign({}, props), children))) : (React.createElement(GrafanaFieldSet, Object.assign({ className: cx(style.fieldSetWrapper, props.className) }, props, { label: label }), children));
};
export default FieldSet;
//# sourceMappingURL=FieldSet.js.map