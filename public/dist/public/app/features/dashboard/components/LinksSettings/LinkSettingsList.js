import { __assign, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { DeleteButton, HorizontalGroup, Icon, IconButton, TagList } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { ListNewButton } from '../DashboardSettings/ListNewButton';
import { arrayUtils } from '@grafana/data';
export var LinkSettingsList = function (_a) {
    var dashboard = _a.dashboard, onNew = _a.onNew, onEdit = _a.onEdit;
    var _b = __read(useState(dashboard.links), 2), links = _b[0], setLinks = _b[1];
    var moveLink = function (idx, direction) {
        dashboard.links = arrayUtils.moveItemImmutably(links, idx, idx + direction);
        setLinks(dashboard.links);
    };
    var duplicateLink = function (link, idx) {
        dashboard.links = __spreadArray(__spreadArray([], __read(links), false), [__assign({}, link)], false);
        setLinks(dashboard.links);
    };
    var deleteLink = function (idx) {
        dashboard.links = __spreadArray(__spreadArray([], __read(links.slice(0, idx)), false), __read(links.slice(idx + 1)), false);
        setLinks(dashboard.links);
    };
    var isEmptyList = dashboard.links.length === 0;
    if (isEmptyList) {
        return (React.createElement(EmptyListCTA, { onClick: onNew, title: "There are no dashboard links added yet", buttonIcon: "link", buttonTitle: "Add dashboard link", infoBoxTitle: "What are dashboard links?", infoBox: {
                __html: '<p>Dashboard Links allow you to place links to other dashboards and web sites directly below the dashboard header.</p>',
            } }));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("table", { className: "filter-table filter-table--hover" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Type"),
                    React.createElement("th", null, "Info"),
                    React.createElement("th", { colSpan: 3 }))),
            React.createElement("tbody", null, links.map(function (link, idx) {
                var _a;
                return (React.createElement("tr", { key: link.title + "-" + idx },
                    React.createElement("td", { className: "pointer", onClick: function () { return onEdit(idx); } },
                        React.createElement(Icon, { name: "external-link-alt" }),
                        " \u00A0 ",
                        link.type),
                    React.createElement("td", null,
                        React.createElement(HorizontalGroup, null,
                            link.title && React.createElement("span", null, link.title),
                            link.type === 'link' && React.createElement("span", null, link.url),
                            link.type === 'dashboards' && React.createElement(TagList, { tags: (_a = link.tags) !== null && _a !== void 0 ? _a : [] }))),
                    React.createElement("td", { style: { width: '1%' } }, idx !== 0 && (React.createElement(IconButton, { surface: "header", name: "arrow-up", "aria-label": "arrow-up", onClick: function () { return moveLink(idx, -1); } }))),
                    React.createElement("td", { style: { width: '1%' } }, links.length > 1 && idx !== links.length - 1 ? (React.createElement(IconButton, { surface: "header", name: "arrow-down", "aria-label": "arrow-down", onClick: function () { return moveLink(idx, 1); } })) : null),
                    React.createElement("td", { style: { width: '1%' } },
                        React.createElement(IconButton, { surface: "header", "aria-label": "copy", name: "copy", onClick: function () { return duplicateLink(link, idx); } })),
                    React.createElement("td", { style: { width: '1%' } },
                        React.createElement(DeleteButton, { "aria-label": "Delete link with title \"" + link.title + "\"", size: "sm", onConfirm: function () { return deleteLink(idx); } }))));
            }))),
        React.createElement(ListNewButton, { onClick: onNew }, "New link")));
};
//# sourceMappingURL=LinkSettingsList.js.map