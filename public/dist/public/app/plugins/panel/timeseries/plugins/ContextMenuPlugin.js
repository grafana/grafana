import { __assign, __makeTemplateObject, __read, __rest, __spreadArray } from "tslib";
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css as cssCore, Global } from '@emotion/react';
import { ContextMenu, GraphContextMenuHeader, MenuGroup, MenuItem, } from '@grafana/ui';
import { getFieldDisplayName } from '@grafana/data';
import { useClickAway } from 'react-use';
import { pluginLog } from '@grafana/ui/src/components/uPlot/utils';
export var ContextMenuPlugin = function (_a) {
    var data = _a.data, config = _a.config, onClose = _a.onClose, timeZone = _a.timeZone, replaceVariables = _a.replaceVariables, otherProps = __rest(_a, ["data", "config", "onClose", "timeZone", "replaceVariables"]);
    var plotCanvas = useRef();
    var _b = __read(useState(null), 2), coords = _b[0], setCoords = _b[1];
    var _c = __read(useState(null), 2), point = _c[0], setPoint = _c[1];
    var _d = __read(useState(false), 2), isOpen = _d[0], setIsOpen = _d[1];
    var openMenu = useCallback(function () {
        setIsOpen(true);
    }, [setIsOpen]);
    var closeMenu = useCallback(function () {
        setIsOpen(false);
    }, [setIsOpen]);
    var clearSelection = useCallback(function () {
        pluginLog('ContextMenuPlugin', false, 'clearing click selection');
        setPoint(null);
    }, [setPoint]);
    // Add uPlot hooks to the config, or re-add when the config changed
    useLayoutEffect(function () {
        var bbox = undefined;
        var onMouseCapture = function (e) {
            var update = {
                viewport: {
                    x: e.clientX,
                    y: e.clientY,
                },
                plotCanvas: {
                    x: 0,
                    y: 0,
                },
            };
            if (bbox) {
                update = __assign(__assign({}, update), { plotCanvas: {
                        x: e.clientX - bbox.left,
                        y: e.clientY - bbox.top,
                    } });
            }
            setCoords(update);
        };
        // cache uPlot plotting area bounding box
        config.addHook('syncRect', function (u, rect) {
            bbox = rect;
        });
        config.addHook('init', function (u) {
            var _a, _b, _c, _d;
            var canvas = u.over;
            plotCanvas.current = canvas || undefined;
            (_a = plotCanvas.current) === null || _a === void 0 ? void 0 : _a.addEventListener('mousedown', onMouseCapture);
            pluginLog('ContextMenuPlugin', false, 'init');
            // for naive click&drag check
            var isClick = false;
            // REF: https://github.com/leeoniya/uPlot/issues/239
            var pts = Array.from(u.root.querySelectorAll('.u-cursor-pt'));
            (_b = plotCanvas.current) === null || _b === void 0 ? void 0 : _b.addEventListener('mousedown', function () {
                isClick = true;
            });
            (_c = plotCanvas.current) === null || _c === void 0 ? void 0 : _c.addEventListener('mousemove', function () {
                isClick = false;
            });
            // TODO: remove listeners on unmount
            (_d = plotCanvas.current) === null || _d === void 0 ? void 0 : _d.addEventListener('mouseup', function (e) {
                // ignore cmd+click, this is handled by annotation editor
                if (!isClick || e.metaKey || e.ctrlKey) {
                    setPoint(null);
                    return;
                }
                isClick = true;
                if (e.target) {
                    var target = e.target;
                    if (!target.classList.contains('u-cursor-pt')) {
                        pluginLog('ContextMenuPlugin', false, 'canvas click');
                        setPoint({ seriesIdx: null, dataIdx: null });
                    }
                }
                openMenu();
            });
            if (pts.length > 0) {
                pts.forEach(function (pt, i) {
                    // TODO: remove listeners on unmount
                    pt.addEventListener('click', function () {
                        var seriesIdx = i + 1;
                        var dataIdx = u.cursor.idx;
                        pluginLog('ContextMenuPlugin', false, seriesIdx, dataIdx);
                        setPoint({ seriesIdx: seriesIdx, dataIdx: dataIdx || null });
                    });
                });
            }
        });
    }, [config, openMenu, setCoords, setPoint]);
    var defaultItems = useMemo(function () {
        return otherProps.defaultItems
            ? otherProps.defaultItems.map(function (i) {
                return __assign(__assign({}, i), { items: i.items.map(function (j) {
                        return __assign(__assign({}, j), { onClick: function (e) {
                                if (!coords) {
                                    return;
                                }
                                if (j.onClick) {
                                    j.onClick(e, { coords: coords });
                                }
                            } });
                    }) });
            })
            : [];
    }, [coords, otherProps.defaultItems]);
    return (React.createElement(React.Fragment, null,
        React.createElement(Global, { styles: cssCore(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        .uplot .u-cursor-pt {\n          pointer-events: auto !important;\n        }\n      "], ["\n        .uplot .u-cursor-pt {\n          pointer-events: auto !important;\n        }\n      "]))) }),
        isOpen && coords && (React.createElement(ContextMenuView, { data: data, defaultItems: defaultItems, timeZone: timeZone, selection: { point: point, coords: coords }, replaceVariables: replaceVariables, onClose: function () {
                clearSelection();
                closeMenu();
                if (onClose) {
                    onClose();
                }
            } }))));
};
export var ContextMenuView = function (_a) {
    var selection = _a.selection, timeZone = _a.timeZone, defaultItems = _a.defaultItems, replaceVariables = _a.replaceVariables, data = _a.data, otherProps = __rest(_a, ["selection", "timeZone", "defaultItems", "replaceVariables", "data"]);
    var ref = useRef(null);
    var onClose = function () {
        if (otherProps.onClose) {
            otherProps.onClose();
        }
    };
    useClickAway(ref, function () {
        onClose();
    });
    var xField = data.fields[0];
    if (!xField) {
        return null;
    }
    var items = defaultItems ? __spreadArray([], __read(defaultItems), false) : [];
    var renderHeader = function () { return null; };
    if (selection.point) {
        var _b = selection.point, seriesIdx = _b.seriesIdx, dataIdx_1 = _b.dataIdx;
        var xFieldFmt_1 = xField.display;
        if (seriesIdx && dataIdx_1) {
            var field_1 = data.fields[seriesIdx];
            var displayValue_1 = field_1.display(field_1.values.get(dataIdx_1));
            var hasLinks = field_1.config.links && field_1.config.links.length > 0;
            if (hasLinks) {
                if (field_1.getLinks) {
                    items.push({
                        items: field_1
                            .getLinks({
                            valueRowIndex: dataIdx_1,
                        })
                            .map(function (link) {
                            return {
                                label: link.title,
                                ariaLabel: link.title,
                                url: link.href,
                                target: link.target,
                                icon: "" + (link.target === '_self' ? 'link' : 'external-link-alt'),
                                onClick: link.onClick,
                            };
                        }),
                    });
                }
            }
            // eslint-disable-next-line react/display-name
            renderHeader = function () { return (React.createElement(GraphContextMenuHeader, { timestamp: xFieldFmt_1(xField.values.get(dataIdx_1)).text, displayValue: displayValue_1, seriesColor: displayValue_1.color, displayName: getFieldDisplayName(field_1, data) })); };
        }
    }
    var renderMenuGroupItems = function () {
        return items === null || items === void 0 ? void 0 : items.map(function (group, index) { return (React.createElement(MenuGroup, { key: "" + group.label + index, label: group.label }, (group.items || []).map(function (item) { return (React.createElement(MenuItem, { key: item.label, url: item.url, label: item.label, target: item.target, icon: item.icon, active: item.active, onClick: item.onClick })); }))); });
    };
    return (React.createElement(ContextMenu, { renderMenuItems: renderMenuGroupItems, renderHeader: renderHeader, x: selection.coords.viewport.x, y: selection.coords.viewport.y, onClose: onClose }));
};
var templateObject_1;
//# sourceMappingURL=ContextMenuPlugin.js.map