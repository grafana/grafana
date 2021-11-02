import { __assign, __read, __spreadArray } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, HorizontalGroup, IconButton } from '@grafana/ui';
import { prepareItems } from '../../utils/dynamicTable';
import { DynamicTable } from '../DynamicTable';
import { AmRoutesExpandedForm } from './AmRoutesExpandedForm';
import { AmRoutesExpandedRead } from './AmRoutesExpandedRead';
import { Matchers } from '../silences/Matchers';
import { matcherFieldToMatcher } from '../../utils/alertmanager';
export var AmRoutesTable = function (_a) {
    var isAddMode = _a.isAddMode, onCancelAdd = _a.onCancelAdd, onChange = _a.onChange, receivers = _a.receivers, routes = _a.routes, _b = _a.readOnly, readOnly = _b === void 0 ? false : _b;
    var _c = __read(useState(false), 2), editMode = _c[0], setEditMode = _c[1];
    var _d = __read(useState(), 2), expandedId = _d[0], setExpandedId = _d[1];
    var expandItem = useCallback(function (item) { return setExpandedId(item.id); }, []);
    var collapseItem = useCallback(function () { return setExpandedId(undefined); }, []);
    var cols = __spreadArray([
        {
            id: 'matchingCriteria',
            label: 'Matching labels',
            // eslint-disable-next-line react/display-name
            renderCell: function (item) { return React.createElement(Matchers, { matchers: item.data.object_matchers.map(matcherFieldToMatcher) }); },
            size: 10,
        },
        {
            id: 'groupBy',
            label: 'Group by',
            renderCell: function (item) { return item.data.groupBy.join(', ') || '-'; },
            size: 5,
        },
        {
            id: 'receiverChannel',
            label: 'Contact point',
            renderCell: function (item) { return item.data.receiver || '-'; },
            size: 5,
        }
    ], __read((readOnly
        ? []
        : [
            {
                id: 'actions',
                label: 'Actions',
                // eslint-disable-next-line react/display-name
                renderCell: function (item, index) {
                    if (item.renderExpandedContent) {
                        return null;
                    }
                    var expandWithCustomContent = function () {
                        expandItem(item);
                        setEditMode(true);
                    };
                    return (React.createElement(HorizontalGroup, null,
                        React.createElement(Button, { "data-testid": "edit-route", icon: "pen", onClick: expandWithCustomContent, size: "sm", type: "button", variant: "secondary" }, "Edit"),
                        React.createElement(IconButton, { "data-testid": "delete-route", name: "trash-alt", onClick: function () {
                                var newRoutes = __spreadArray([], __read(routes), false);
                                newRoutes.splice(index, 1);
                                onChange(newRoutes);
                            }, type: "button" })));
                },
                size: '100px',
            },
        ])), false);
    var items = useMemo(function () { return prepareItems(routes); }, [routes]);
    // expand the last item when adding
    useEffect(function () {
        if (isAddMode && items.length) {
            setExpandedId(items[items.length - 1].id);
        }
    }, [isAddMode, items]);
    return (React.createElement(DynamicTable, { cols: cols, isExpandable: true, items: items, testIdGenerator: function () { return 'am-routes-row'; }, onCollapse: collapseItem, onExpand: expandItem, isExpanded: function (item) { return expandedId === item.id; }, renderExpandedContent: function (item, index) {
            return isAddMode || editMode ? (React.createElement(AmRoutesExpandedForm, { onCancel: function () {
                    if (isAddMode) {
                        onCancelAdd();
                    }
                    setEditMode(false);
                }, onSave: function (data) {
                    var newRoutes = __spreadArray([], __read(routes), false);
                    newRoutes[index] = __assign(__assign({}, newRoutes[index]), data);
                    setEditMode(false);
                    onChange(newRoutes);
                }, receivers: receivers, routes: item.data })) : (React.createElement(AmRoutesExpandedRead, { onChange: function (data) {
                    var newRoutes = __spreadArray([], __read(routes), false);
                    newRoutes[index] = __assign(__assign({}, item.data), data);
                    onChange(newRoutes);
                }, receivers: receivers, routes: item.data, readOnly: readOnly }));
        } }));
};
//# sourceMappingURL=AmRoutesTable.js.map