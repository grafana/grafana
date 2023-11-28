import { css } from '@emotion/css';
import React, { useState } from 'react';
import { arrayUtils } from '@grafana/data';
import { DeleteButton, HorizontalGroup, Icon, IconButton, TagList, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { ListNewButton } from '../DashboardSettings/ListNewButton';
export const LinkSettingsList = ({ dashboard, onNew, onEdit }) => {
    const styles = useStyles2(getStyles);
    const [links, setLinks] = useState(dashboard.links);
    const moveLink = (idx, direction) => {
        dashboard.links = arrayUtils.moveItemImmutably(links, idx, idx + direction);
        setLinks(dashboard.links);
    };
    const duplicateLink = (link, idx) => {
        dashboard.links = [...links, Object.assign({}, link)];
        setLinks(dashboard.links);
    };
    const deleteLink = (idx) => {
        dashboard.links = [...links.slice(0, idx), ...links.slice(idx + 1)];
        setLinks(dashboard.links);
    };
    const isEmptyList = dashboard.links.length === 0;
    if (isEmptyList) {
        return (React.createElement("div", null,
            React.createElement(EmptyListCTA, { onClick: onNew, title: "There are no dashboard links added yet", buttonIcon: "link", buttonTitle: "Add dashboard link", infoBoxTitle: "What are dashboard links?", infoBox: {
                    __html: '<p>Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard header.</p>',
                } })));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("table", { role: "grid", className: "filter-table filter-table--hover" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Type"),
                    React.createElement("th", null, "Info"),
                    React.createElement("th", { colSpan: 3 }))),
            React.createElement("tbody", null, links.map((link, idx) => {
                var _a;
                return (React.createElement("tr", { key: `${link.title}-${idx}` },
                    React.createElement("td", { role: "gridcell", className: "pointer", onClick: () => onEdit(idx) },
                        React.createElement(Icon, { name: "external-link-alt" }),
                        " \u00A0 ",
                        link.type),
                    React.createElement("td", { role: "gridcell" },
                        React.createElement(HorizontalGroup, null,
                            link.title && React.createElement("span", { className: styles.titleWrapper }, link.title),
                            link.type === 'link' && React.createElement("span", { className: styles.urlWrapper }, link.url),
                            link.type === 'dashboards' && React.createElement(TagList, { tags: (_a = link.tags) !== null && _a !== void 0 ? _a : [] }))),
                    React.createElement("td", { style: { width: '1%' }, role: "gridcell" }, idx !== 0 && React.createElement(IconButton, { name: "arrow-up", onClick: () => moveLink(idx, -1), tooltip: "Move link up" })),
                    React.createElement("td", { style: { width: '1%' }, role: "gridcell" }, links.length > 1 && idx !== links.length - 1 ? (React.createElement(IconButton, { name: "arrow-down", onClick: () => moveLink(idx, 1), tooltip: "Move link down" })) : null),
                    React.createElement("td", { style: { width: '1%' }, role: "gridcell" },
                        React.createElement(IconButton, { name: "copy", onClick: () => duplicateLink(link, idx), tooltip: "Copy link" })),
                    React.createElement("td", { style: { width: '1%' }, role: "gridcell" },
                        React.createElement(DeleteButton, { "aria-label": `Delete link with title "${link.title}"`, size: "sm", onConfirm: () => deleteLink(idx) }))));
            }))),
        React.createElement(ListNewButton, { onClick: onNew }, "New link")));
};
const getStyles = () => ({
    titleWrapper: css `
    width: 20vw;
    text-overflow: ellipsis;
    overflow: hidden;
  `,
    urlWrapper: css `
    width: 40vw;
    text-overflow: ellipsis;
    overflow: hidden;
  `,
});
//# sourceMappingURL=LinkSettingsList.js.map