import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, IconButton, useStyles2, Spinner } from '@grafana/ui';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';
import { t, Trans } from 'app/core/internationalization';
export const PlaylistTableRows = ({ items, onDelete }) => {
    const styles = useStyles2(getStyles);
    if (!(items === null || items === void 0 ? void 0 : items.length)) {
        return (React.createElement("div", null,
            React.createElement("em", null,
                React.createElement(Trans, { i18nKey: "playlist-edit.form.table-empty" }, "Playlist is empty. Add dashboards below."))));
    }
    const renderItem = (item) => {
        var _a, _b;
        let icon = item.type === 'dashboard_by_tag' ? 'apps' : 'tag-alt';
        const info = [];
        const first = (_a = item.dashboards) === null || _a === void 0 ? void 0 : _a[0];
        if (!item.dashboards) {
            info.push(React.createElement(Spinner, { key: "spinner" }));
        }
        else if (item.type === 'dashboard_by_tag') {
            info.push(React.createElement(TagBadge, { key: item.value, label: item.value, removeIcon: false, count: 0 }));
            if (!first) {
                icon = 'exclamation-triangle';
                info.push(React.createElement("span", { key: "info" }, "\u00A0 No dashboards found"));
            }
            else {
                info.push(React.createElement("span", { key: "info" },
                    "\u00A0 ",
                    pluralize('dashboard', item.dashboards.length, true)));
            }
        }
        else if (first) {
            info.push(item.dashboards.length > 1 ? (React.createElement("span", { key: "info" },
                "Multiple items found: $",
                item.value)) : (React.createElement("span", { key: "info" }, (_b = first.name) !== null && _b !== void 0 ? _b : item.value)));
        }
        else {
            icon = 'exclamation-triangle';
            info.push(React.createElement("span", { key: "info" },
                "\u00A0 Not found: ",
                item.value));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(Icon, { name: icon, className: styles.rightMargin, key: "icon" }),
            info));
    };
    return (React.createElement(React.Fragment, null, items.map((item, index) => (React.createElement(Draggable, { key: `${index}/${item.value}`, draggableId: `${index}`, index: index }, (provided) => (React.createElement("div", Object.assign({ className: styles.row, ref: provided.innerRef }, provided.draggableProps, provided.dragHandleProps, { role: "row" }),
        React.createElement("div", { className: styles.actions, role: "cell", "aria-label": `Playlist item, ${item.type}, ${item.value}` }, renderItem(item)),
        React.createElement("div", { className: styles.actions },
            React.createElement(IconButton, { name: "times", size: "md", onClick: () => onDelete(index), "data-testid": selectors.pages.PlaylistForm.itemDelete, tooltip: t('playlist-edit.form.table-delete', 'Delete playlist item') }),
            React.createElement(Icon, { title: t('playlist-edit.form.table-drag', 'Drag and drop to reorder'), name: "draggabledots", size: "md" })))))))));
};
function getStyles(theme) {
    return {
        row: css `
      padding: 6px;
      background: ${theme.colors.background.secondary};
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3px;

      border: 1px solid ${theme.colors.border.medium};
      &:hover {
        border: 1px solid ${theme.colors.border.strong};
      }
    `,
        rightMargin: css `
      margin-right: 5px;
    `,
        actions: css `
      align-items: center;
      justify-content: center;
      display: flex;
    `,
        settings: css `
      label: settings;
      text-align: right;
    `,
    };
}
//# sourceMappingURL=PlaylistTableRows.js.map