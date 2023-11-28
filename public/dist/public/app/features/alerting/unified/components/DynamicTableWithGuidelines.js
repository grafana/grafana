import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { DynamicTable } from './DynamicTable';
// DynamicTable, but renders visual guidelines on the left, for larger screen widths
export const DynamicTableWithGuidelines = (_a) => {
    var { renderExpandedContent } = _a, props = __rest(_a, ["renderExpandedContent"]);
    const styles = useStyles2(getStyles);
    return (React.createElement(DynamicTable, Object.assign({ renderExpandedContent: renderExpandedContent
            ? (item, index, items) => (React.createElement(React.Fragment, null,
                !(index === items.length - 1) && React.createElement("div", { className: cx(styles.contentGuideline, styles.guideline) }),
                renderExpandedContent(item, index, items)))
            : undefined, renderPrefixHeader: () => (React.createElement("div", { className: styles.relative },
            React.createElement("div", { className: cx(styles.headerGuideline, styles.guideline) }))), renderPrefixCell: (_, index, items) => (React.createElement("div", { className: styles.relative },
            React.createElement("div", { className: cx(styles.topGuideline, styles.guideline) }),
            !(index === items.length - 1) && React.createElement("div", { className: cx(styles.bottomGuideline, styles.guideline) }))) }, props)));
};
export const getStyles = (theme) => ({
    relative: css `
    position: relative;
    height: 100%;
  `,
    guideline: css `
    left: -19px;
    border-left: 1px solid ${theme.colors.border.weak};
    position: absolute;

    ${theme.breakpoints.down('md')} {
      display: none;
    }
  `,
    topGuideline: css `
    width: 18px;
    border-bottom: 1px solid ${theme.colors.border.medium};
    top: 0;
    bottom: 50%;
  `,
    bottomGuideline: css `
    top: 50%;
    bottom: 0;
  `,
    contentGuideline: css `
    top: 0;
    bottom: 0;
    left: -49px !important;
  `,
    headerGuideline: css `
    top: -17px;
    bottom: 0;
  `,
});
//# sourceMappingURL=DynamicTableWithGuidelines.js.map