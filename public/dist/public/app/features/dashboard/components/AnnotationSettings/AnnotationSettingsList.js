import { __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { DeleteButton, Icon, IconButton, VerticalGroup } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { ListNewButton } from '../DashboardSettings/ListNewButton';
import { arrayUtils } from '@grafana/data';
export var AnnotationSettingsList = function (_a) {
    var dashboard = _a.dashboard, onNew = _a.onNew, onEdit = _a.onEdit;
    var _b = __read(useState(dashboard.annotations.list), 2), annotations = _b[0], updateAnnotations = _b[1];
    var onMove = function (idx, direction) {
        dashboard.annotations.list = arrayUtils.moveItemImmutably(annotations, idx, idx + direction);
        updateAnnotations(dashboard.annotations.list);
    };
    var onDelete = function (idx) {
        dashboard.annotations.list = __spreadArray(__spreadArray([], __read(annotations.slice(0, idx)), false), __read(annotations.slice(idx + 1)), false);
        updateAnnotations(dashboard.annotations.list);
    };
    var showEmptyListCTA = annotations.length === 0 || (annotations.length === 1 && annotations[0].builtIn);
    return (React.createElement(VerticalGroup, null,
        annotations.length > 0 && (React.createElement("table", { className: "filter-table filter-table--hover" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Query name"),
                    React.createElement("th", null, "Data source"),
                    React.createElement("th", { colSpan: 3 }))),
            React.createElement("tbody", null, dashboard.annotations.list.map(function (annotation, idx) { return (React.createElement("tr", { key: annotation.name + "-" + idx },
                !annotation.builtIn && (React.createElement("td", { className: "pointer", onClick: function () { return onEdit(idx); } },
                    React.createElement(Icon, { name: "comment-alt" }),
                    " \u00A0 ",
                    annotation.name)),
                annotation.builtIn && (React.createElement("td", { style: { width: '90%' }, className: "pointer", onClick: function () { return onEdit(idx); } },
                    React.createElement(Icon, { name: "comment-alt" }),
                    " \u00A0 ",
                    React.createElement("em", { className: "muted" },
                        annotation.name,
                        " (Built-in)"))),
                React.createElement("td", { className: "pointer", onClick: function () { return onEdit(idx); } }, annotation.datasource || 'Default'),
                React.createElement("td", { style: { width: '1%' } }, idx !== 0 && (React.createElement(IconButton, { surface: "header", name: "arrow-up", "aria-label": "arrow-up", onClick: function () { return onMove(idx, -1); } }))),
                React.createElement("td", { style: { width: '1%' } }, dashboard.annotations.list.length > 1 && idx !== dashboard.annotations.list.length - 1 ? (React.createElement(IconButton, { surface: "header", name: "arrow-down", "aria-label": "arrow-down", onClick: function () { return onMove(idx, 1); } })) : null),
                React.createElement("td", { style: { width: '1%' } },
                    React.createElement(DeleteButton, { size: "sm", onConfirm: function () { return onDelete(idx); }, "aria-label": "Delete query with title \"" + annotation.name + "\"" })))); })))),
        showEmptyListCTA && (React.createElement(EmptyListCTA, { onClick: onNew, title: "There are no custom annotation queries added yet", buttonIcon: "comment-alt", buttonTitle: "Add annotation query", infoBoxTitle: "What are annotation queries?", infoBox: {
                __html: "<p>Annotations provide a way to integrate event data into your graphs. They are visualized as vertical lines\n          and icons on all graph panels. When you hover over an annotation icon you can get event text &amp; tags for\n          the event. You can add annotation events directly from grafana by holding CTRL or CMD + click on graph (or\n          drag region). These will be stored in Grafana's annotation database.\n        </p>\n        Checkout the\n        <a class='external-link' target='_blank' href='http://docs.grafana.org/reference/annotations/'\n          >Annotations documentation</a\n        >\n        for more information.",
            } })),
        !showEmptyListCTA && React.createElement(ListNewButton, { onClick: onNew }, "New query")));
};
//# sourceMappingURL=AnnotationSettingsList.js.map