import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { IconButton, Pagination, useStyles2 } from '@grafana/ui';
import { usePagination } from '../hooks/usePagination';
import { getPaginationStyles } from '../styles/pagination';
export const DynamicTable = ({ cols, items, isExpandable = false, onCollapse, onExpand, isExpanded, renderExpandedContent, testIdGenerator, pagination, paginationStyles, 
// render a cell BEFORE expand icon for header/ each row.
// currently use by RuleList to render guidelines
renderPrefixCell, renderPrefixHeader, footerRow, dataTestId, }) => {
    var _a;
    const defaultPaginationStyles = useStyles2(getPaginationStyles);
    if ((onCollapse || onExpand || isExpanded) && !(onCollapse && onExpand && isExpanded)) {
        throw new Error('either all of onCollapse, onExpand, isExpanded must be provided, or none');
    }
    if ((isExpandable || renderExpandedContent) && !(isExpandable && renderExpandedContent)) {
        throw new Error('either both isExpanded and renderExpandedContent must be provided, or neither');
    }
    const styles = useStyles2(getStyles(cols, isExpandable, !!renderPrefixHeader));
    const [expandedIds, setExpandedIds] = useState([]);
    const toggleExpanded = (item) => {
        if (isExpanded && onCollapse && onExpand) {
            isExpanded(item) ? onCollapse(item) : onExpand(item);
        }
        else {
            setExpandedIds(expandedIds.includes(item.id) ? expandedIds.filter((itemId) => itemId !== item.id) : [...expandedIds, item.id]);
        }
    };
    const itemsPerPage = (_a = pagination === null || pagination === void 0 ? void 0 : pagination.itemsPerPage) !== null && _a !== void 0 ? _a : items.length;
    const { page, numberOfPages, onPageChange, pageItems } = usePagination(items, 1, itemsPerPage);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.container, "data-testid": dataTestId !== null && dataTestId !== void 0 ? dataTestId : 'dynamic-table' },
            React.createElement("div", { className: styles.row, "data-testid": "header" },
                renderPrefixHeader && renderPrefixHeader(),
                isExpandable && React.createElement("div", { className: styles.cell }),
                cols.map((col) => (React.createElement("div", { className: styles.cell, key: col.id }, col.label)))),
            pageItems.map((item, index) => {
                var _a;
                const isItemExpanded = isExpanded ? isExpanded(item) : expandedIds.includes(item.id);
                return (React.createElement("div", { className: styles.row, key: `${item.id}-${index}`, "data-testid": (_a = testIdGenerator === null || testIdGenerator === void 0 ? void 0 : testIdGenerator(item, index)) !== null && _a !== void 0 ? _a : 'row' },
                    renderPrefixCell && renderPrefixCell(item, index, items),
                    isExpandable && (React.createElement("div", { className: cx(styles.cell, styles.expandCell) },
                        React.createElement(IconButton, { tooltip: `${isItemExpanded ? 'Collapse' : 'Expand'} row`, "data-testid": "collapse-toggle", name: isItemExpanded ? 'angle-down' : 'angle-right', onClick: () => toggleExpanded(item) }))),
                    cols.map((col) => (React.createElement("div", { className: cx(styles.cell, styles.bodyCell, col.className), "data-column": col.label, key: `${item.id}-${col.id}` }, col.renderCell(item, index)))),
                    isItemExpanded && renderExpandedContent && (React.createElement("div", { className: styles.expandedContentRow, "data-testid": "expanded-content" }, renderExpandedContent(item, index, items)))));
            }),
            footerRow && React.createElement("div", { className: cx(styles.row, styles.footerRow) }, footerRow)),
        pagination && (React.createElement(Pagination, { className: cx(defaultPaginationStyles, paginationStyles), currentPage: page, numberOfPages: numberOfPages, onNavigate: onPageChange, hideWhenSinglePage: true }))));
};
const getStyles = (cols, isExpandable, hasPrefixCell) => {
    const sizes = cols.map((col) => {
        if (!col.size) {
            return 'auto';
        }
        if (typeof col.size === 'number') {
            return `${col.size}fr`;
        }
        return col.size;
    });
    if (isExpandable) {
        sizes.unshift('calc(1em + 16px)');
    }
    if (hasPrefixCell) {
        sizes.unshift('0');
    }
    return (theme) => ({
        container: css `
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      color: ${theme.colors.text.secondary};
    `,
        row: css `
      display: grid;
      grid-template-columns: ${sizes.join(' ')};
      grid-template-rows: 1fr auto;

      &:nth-child(2n + 1) {
        background-color: ${theme.colors.background.secondary};
      }

      &:nth-child(2n) {
        background-color: ${theme.colors.background.primary};
      }

      ${theme.breakpoints.down('sm')} {
        grid-template-columns: auto 1fr;
        grid-template-areas: 'left right';
        padding: 0 ${theme.spacing(0.5)};

        &:first-child {
          display: none;
        }

        ${hasPrefixCell
            ? `
            & > *:first-child {
              display: none;
            }
          `
            : ''}
      }
    `,
        footerRow: css `
      display: flex;
      padding: ${theme.spacing(1)};
    `,
        cell: css `
      display: flex;
      align-items: center;
      padding: ${theme.spacing(1)};

      ${theme.breakpoints.down('sm')} {
        padding: ${theme.spacing(1)} 0;
        grid-template-columns: 1fr;
      }
    `,
        bodyCell: css `
      overflow: hidden;
      // @PERCONA
      word-break: break-all;

      ${theme.breakpoints.down('sm')} {
        grid-column-end: right;
        grid-column-start: right;

        &::before {
          content: attr(data-column);
          display: block;
          color: ${theme.colors.text.primary};
        }
      }
    `,
        expandCell: css `
      justify-content: center;

      ${theme.breakpoints.down('sm')} {
        align-items: start;
        grid-area: left;
      }
    `,
        expandedContentRow: css `
      grid-column-end: ${sizes.length + 1};
      grid-column-start: ${hasPrefixCell ? 3 : 2};
      grid-row: 2;
      padding: 0 ${theme.spacing(3)} 0 ${theme.spacing(1)};
      position: relative;

      ${theme.breakpoints.down('sm')} {
        grid-column-start: 2;
        border-top: 1px solid ${theme.colors.border.strong};
        grid-row: auto;
        padding: ${theme.spacing(1)} 0 0 0;
      }
    `,
    });
};
//# sourceMappingURL=DynamicTable.js.map