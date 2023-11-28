import { css } from '@emotion/css';
import React, { useState } from 'react';
import { arrayUtils } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, DeleteButton, IconButton, useStyles2, VerticalGroup } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { ListNewButton } from '../DashboardSettings/ListNewButton';
export const AnnotationSettingsList = ({ dashboard, onNew, onEdit }) => {
    const styles = useStyles2(getStyles);
    const [annotations, updateAnnotations] = useState(dashboard.annotations.list);
    const onMove = (idx, direction) => {
        dashboard.annotations.list = arrayUtils.moveItemImmutably(annotations, idx, idx + direction);
        updateAnnotations(dashboard.annotations.list);
    };
    const onDelete = (idx) => {
        dashboard.annotations.list = [...annotations.slice(0, idx), ...annotations.slice(idx + 1)];
        updateAnnotations(dashboard.annotations.list);
    };
    const showEmptyListCTA = annotations.length === 0 || (annotations.length === 1 && annotations[0].builtIn);
    const getAnnotationName = (anno) => {
        if (anno.enable === false) {
            return (React.createElement(React.Fragment, null,
                React.createElement("em", { className: "muted" },
                    "(Disabled) \u00A0 ",
                    anno.name)));
        }
        if (anno.builtIn) {
            return (React.createElement(React.Fragment, null,
                React.createElement("em", { className: "muted" },
                    anno.name,
                    " \u00A0 (Built-in)")));
        }
        return React.createElement(React.Fragment, null, anno.name);
    };
    const dataSourceSrv = getDataSourceSrv();
    return (React.createElement(VerticalGroup, null,
        annotations.length > 0 && (React.createElement("div", { className: styles.table },
            React.createElement("table", { role: "grid", className: "filter-table filter-table--hover" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Query name"),
                        React.createElement("th", null, "Data source"),
                        React.createElement("th", { colSpan: 3 }))),
                React.createElement("tbody", null, dashboard.annotations.list.map((annotation, idx) => {
                    var _a, _b;
                    return (React.createElement("tr", { key: `${annotation.name}-${idx}` },
                        annotation.builtIn ? (React.createElement("td", { role: "gridcell", style: { width: '90%' }, className: "pointer", onClick: () => onEdit(idx) },
                            React.createElement(Button, { size: "sm", fill: "text", variant: "secondary" }, getAnnotationName(annotation)))) : (React.createElement("td", { role: "gridcell", className: "pointer", onClick: () => onEdit(idx) },
                            React.createElement(Button, { size: "sm", fill: "text", variant: "secondary" }, getAnnotationName(annotation)))),
                        React.createElement("td", { role: "gridcell", className: "pointer", onClick: () => onEdit(idx) }, ((_a = dataSourceSrv.getInstanceSettings(annotation.datasource)) === null || _a === void 0 ? void 0 : _a.name) || ((_b = annotation.datasource) === null || _b === void 0 ? void 0 : _b.uid)),
                        React.createElement("td", { role: "gridcell", style: { width: '1%' } }, idx !== 0 && React.createElement(IconButton, { name: "arrow-up", onClick: () => onMove(idx, -1), tooltip: "Move up" })),
                        React.createElement("td", { role: "gridcell", style: { width: '1%' } }, dashboard.annotations.list.length > 1 && idx !== dashboard.annotations.list.length - 1 ? (React.createElement(IconButton, { name: "arrow-down", onClick: () => onMove(idx, 1), tooltip: "Move down" })) : null),
                        React.createElement("td", { role: "gridcell", style: { width: '1%' } }, !annotation.builtIn && (React.createElement(DeleteButton, { size: "sm", onConfirm: () => onDelete(idx), "aria-label": `Delete query with title "${annotation.name}"` })))));
                }))))),
        showEmptyListCTA && (React.createElement(EmptyListCTA, { onClick: onNew, title: "There are no custom annotation queries added yet", buttonIcon: "comment-alt", buttonTitle: "Add annotation query", infoBoxTitle: "What are annotation queries?", infoBox: {
                __html: `<p>Annotations provide a way to integrate event data into your graphs. They are visualized as vertical lines
          and icons on all graph panels. When you hover over an annotation icon you can get event text &amp; tags for
          the event. You can add annotation events directly from grafana by holding CTRL or CMD + click on graph (or
          drag region). These will be stored in Grafana's annotation database.
        </p>
        Checkout the
        <a class='external-link' target='_blank' href='http://docs.grafana.org/reference/annotations/'
          >Annotations documentation</a
        >
        for more information.`,
            } })),
        !showEmptyListCTA && React.createElement(ListNewButton, { onClick: onNew }, "New query")));
};
const getStyles = () => ({
    table: css `
    width: 100%;
    overflow-x: scroll;
  `,
});
//# sourceMappingURL=AnnotationSettingsList.js.map