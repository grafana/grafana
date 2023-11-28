import { cx } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';
import { FieldType, formattedValueToString, getDisplayProcessor, getFieldDisplayName, } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Checkbox, Icon, TagList, Text } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { PluginIconName } from 'app/features/plugins/admin/types';
import { ShowModalReactEvent } from 'app/types/events';
import { getIconForKind } from '../../service/utils';
import { ExplainScorePopup } from './ExplainScorePopup';
const TYPE_COLUMN_WIDTH = 175;
const DATASOURCE_COLUMN_WIDTH = 200;
export const generateColumns = (response, availableWidth, selection, selectionToggle, clearSelection, styles, onTagSelected, onDatasourceChange, showingEverything) => {
    var _a, _b, _c, _d, _e;
    const columns = [];
    const access = response.view.fields;
    const uidField = access.uid;
    const kindField = access.kind;
    let sortFieldWith = 0;
    const sortField = access[(_b = (_a = response.view.dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.sortBy];
    if (sortField) {
        sortFieldWith = 175;
        if (sortField.type === FieldType.time) {
            sortFieldWith += 25;
        }
        availableWidth -= sortFieldWith; // pre-allocate the space for the last column
    }
    if (access.explain && access.score) {
        availableWidth -= 100; // pre-allocate the space for the last column
    }
    let width = 50;
    if (selection && selectionToggle) {
        width = 0;
        columns.push({
            id: `column-checkbox`,
            width,
            Header: () => {
                const { view } = response;
                const hasSelection = selection('*', '*');
                const allSelected = view.every((item) => selection(item.kind, item.uid));
                return (React.createElement(Checkbox, { indeterminate: !allSelected && hasSelection, checked: allSelected, disabled: !response, onChange: (e) => {
                        if (hasSelection) {
                            clearSelection();
                        }
                        else {
                            for (let i = 0; i < view.length; i++) {
                                const item = view.get(i);
                                selectionToggle(item.kind, item.uid);
                            }
                        }
                    } }));
            },
            Cell: (p) => {
                const uid = uidField.values[p.row.index];
                const kind = kindField ? kindField.values[p.row.index] : 'dashboard'; // HACK for now
                const selected = selection(kind, uid);
                const hasUID = uid != null; // Panels don't have UID! Likely should not be shown on pages with manage options
                return (React.createElement("div", Object.assign({}, p.cellProps, { className: styles.cell }),
                    React.createElement(Checkbox, { disabled: !hasUID, value: selected && hasUID, onChange: (e) => {
                            selectionToggle(kind, uid);
                        } })));
            },
            field: uidField,
        });
        availableWidth -= width;
    }
    // Name column
    width = Math.max(availableWidth * 0.2, 300);
    columns.push({
        Cell: (p) => {
            let classNames = cx(styles.nameCellStyle);
            let name = access.name.values[p.row.index];
            if (!(name === null || name === void 0 ? void 0 : name.length)) {
                const loading = p.row.index >= response.view.dataFrame.length;
                name = loading ? 'Loading...' : 'Missing title'; // normal for panels
                classNames += ' ' + styles.missingTitleText;
            }
            return (React.createElement("div", Object.assign({ className: styles.cell }, p.cellProps), !response.isItemLoaded(p.row.index) ? (React.createElement(Skeleton, { width: 200 })) : (React.createElement("a", { href: p.userProps.href, onClick: p.userProps.onClick, className: classNames, title: name }, name))));
        },
        id: `column-name`,
        field: access.name,
        Header: () => React.createElement("div", null, t('search.results-table.name-header', 'Name')),
        width,
    });
    availableWidth -= width;
    width = TYPE_COLUMN_WIDTH;
    columns.push(makeTypeColumn(response, access.kind, access.panel_type, width, styles));
    availableWidth -= width;
    // Show datasources if we have any
    if (access.ds_uid && onDatasourceChange) {
        width = Math.min(availableWidth / 2.5, DATASOURCE_COLUMN_WIDTH);
        columns.push(makeDataSourceColumn(access.ds_uid, width, styles.typeIcon, styles.datasourceItem, styles.invalidDatasourceItem, onDatasourceChange));
        availableWidth -= width;
    }
    const showTags = !showingEverything || hasValue(response.view.fields.tags);
    const meta = (_c = response.view.dataFrame.meta) === null || _c === void 0 ? void 0 : _c.custom;
    if ((meta === null || meta === void 0 ? void 0 : meta.locationInfo) && availableWidth > 0) {
        width = showTags ? Math.max(availableWidth / 1.75, 300) : availableWidth;
        availableWidth -= width;
        columns.push({
            Cell: (p) => {
                var _a, _b;
                const parts = ((_b = (_a = access.location) === null || _a === void 0 ? void 0 : _a.values[p.row.index]) !== null && _b !== void 0 ? _b : '').split('/');
                return (React.createElement("div", Object.assign({}, p.cellProps, { className: styles.cell }), !response.isItemLoaded(p.row.index) ? (React.createElement(Skeleton, { width: 150 })) : (React.createElement("div", { className: styles.locationContainer }, parts.map((p) => {
                    let info = meta.locationInfo[p];
                    if (!info && p === 'general') {
                        info = { kind: 'folder', url: '/dashboards', name: 'General' };
                    }
                    return info ? (React.createElement("a", { key: p, href: info.url, className: styles.locationItem },
                        React.createElement(Icon, { name: getIconForKind(info.kind) }),
                        React.createElement(Text, { variant: "body", truncate: true }, info.name))) : (React.createElement("span", { key: p }, p));
                })))));
            },
            id: `column-location`,
            field: (_d = access.location) !== null && _d !== void 0 ? _d : access.url,
            Header: t('search.results-table.location-header', 'Location'),
            width,
        });
    }
    if (availableWidth > 0 && showTags) {
        columns.push(makeTagsColumn(response, access.tags, availableWidth, styles, onTagSelected));
    }
    if (sortField && sortFieldWith) {
        const disp = (_e = sortField.display) !== null && _e !== void 0 ? _e : getDisplayProcessor({ field: sortField, theme: config.theme2 });
        columns.push({
            Header: getFieldDisplayName(sortField),
            Cell: (p) => {
                return (React.createElement("div", Object.assign({}, p.cellProps, { className: styles.cell }), getDisplayValue({
                    sortField,
                    getDisplay: disp,
                    index: p.row.index,
                    kind: access.kind,
                })));
            },
            id: `column-sort-field`,
            field: sortField,
            width: sortFieldWith,
        });
    }
    if (access.explain && access.score) {
        const vals = access.score.values;
        const showExplainPopup = (row) => {
            appEvents.publish(new ShowModalReactEvent({
                component: ExplainScorePopup,
                props: {
                    name: access.name.values[row],
                    explain: access.explain.values[row],
                    frame: response.view.dataFrame,
                    row: row,
                },
            }));
        };
        columns.push({
            Header: () => React.createElement("div", { className: styles.sortedHeader }, "Score"),
            Cell: (p) => {
                return (
                // TODO: fix keyboard a11y
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                React.createElement("div", Object.assign({}, p.cellProps, { className: cx(styles.cell, styles.explainItem), onClick: () => showExplainPopup(p.row.index) }), vals[p.row.index]));
            },
            id: `column-score-field`,
            field: access.score,
            width: 100,
        });
    }
    return columns;
};
function hasValue(f) {
    for (let i = 0; i < f.values.length; i++) {
        if (f.values[i] != null) {
            return true;
        }
    }
    return false;
}
function makeDataSourceColumn(field, width, iconClass, datasourceItemClass, invalidDatasourceItemClass, onDatasourceChange) {
    const srv = getDataSourceSrv();
    return {
        id: `column-datasource`,
        field,
        Header: t('search.results-table.datasource-header', 'Data source'),
        Cell: (p) => {
            const dslist = field.values[p.row.index];
            if (!(dslist === null || dslist === void 0 ? void 0 : dslist.length)) {
                return null;
            }
            return (React.createElement("div", Object.assign({}, p.cellProps, { className: cx(datasourceItemClass) }), dslist.map((v, i) => {
                var _a, _b, _c;
                const settings = srv.getInstanceSettings(v);
                const icon = (_c = (_b = (_a = settings === null || settings === void 0 ? void 0 : settings.meta) === null || _a === void 0 ? void 0 : _a.info) === null || _b === void 0 ? void 0 : _b.logos) === null || _c === void 0 ? void 0 : _c.small;
                if (icon) {
                    return (
                    // TODO: fix keyboard a11y
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                    React.createElement("span", { key: i, onClick: (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDatasourceChange(settings.uid);
                        } },
                        React.createElement("img", { src: icon, alt: "", width: 14, height: 14, title: settings.type, className: iconClass }),
                        settings.name));
                }
                return (React.createElement("span", { className: invalidDatasourceItemClass, key: i }, v));
            })));
        },
        width,
    };
}
function makeTypeColumn(response, kindField, typeField, width, styles) {
    return {
        id: `column-type`,
        field: kindField !== null && kindField !== void 0 ? kindField : typeField,
        Header: t('search.results-table.type-header', 'Type'),
        Cell: (p) => {
            var _a;
            const i = p.row.index;
            const kind = (_a = kindField === null || kindField === void 0 ? void 0 : kindField.values[i]) !== null && _a !== void 0 ? _a : 'dashboard';
            let icon = 'apps';
            let txt = 'Dashboard';
            if (kind) {
                txt = kind;
                switch (txt) {
                    case 'dashboard':
                        txt = t('search.results-table.type-dashboard', 'Dashboard');
                        break;
                    case 'folder':
                        icon = 'folder';
                        txt = t('search.results-table.type-folder', 'Folder');
                        break;
                    case 'panel':
                        icon = `${PluginIconName.panel}`;
                        const type = typeField.values[i];
                        if (type) {
                            txt = type;
                            const info = config.panels[txt];
                            if (info === null || info === void 0 ? void 0 : info.name) {
                                txt = info.name;
                            }
                            else {
                                switch (type) {
                                    case 'row':
                                        txt = 'Row';
                                        icon = `bars`;
                                        break;
                                    case 'singlestat': // auto-migration
                                        txt = 'Singlestat';
                                        break;
                                    default:
                                        icon = `question-circle`; // plugin not found
                                }
                            }
                        }
                        break;
                }
            }
            return (React.createElement("div", Object.assign({}, p.cellProps, { className: cx(styles.cell, styles.typeCell) }), !response.isItemLoaded(p.row.index) ? (React.createElement(Skeleton, { width: 100 })) : (React.createElement(React.Fragment, null,
                React.createElement(Icon, { name: icon, size: "sm", title: txt, className: styles.typeIcon }),
                txt))));
        },
        width,
    };
}
function makeTagsColumn(response, field, width, styles, onTagSelected) {
    return {
        Cell: (p) => {
            const tags = field.values[p.row.index];
            return (React.createElement("div", Object.assign({}, p.cellProps, { className: styles.cell }), !response.isItemLoaded(p.row.index) ? (React.createElement(TagList.Skeleton, null)) : (React.createElement(React.Fragment, null, tags ? React.createElement(TagList, { className: styles.tagList, tags: tags, onClick: onTagSelected }) : null))));
        },
        id: `column-tags`,
        field: field,
        Header: t('search.results-table.tags-header', 'Tags'),
        width,
    };
}
function getDisplayValue({ kind, sortField, index, getDisplay, }) {
    const value = sortField.values[index];
    if (['folder', 'panel'].includes(kind.values[index]) && value === 0) {
        return '-';
    }
    return formattedValueToString(getDisplay(value));
}
//# sourceMappingURL=columns.js.map