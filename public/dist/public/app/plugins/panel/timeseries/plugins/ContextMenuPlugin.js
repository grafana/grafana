import { __rest } from "tslib";
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useClickAway } from 'react-use';
import { getFieldDisplayName } from '@grafana/data';
import { ContextMenu, GraphContextMenuHeader, MenuGroup, MenuItem, } from '@grafana/ui';
export const ContextMenuPlugin = (_a) => {
    var { data, config, onClose, timeZone, replaceVariables } = _a, otherProps = __rest(_a, ["data", "config", "onClose", "timeZone", "replaceVariables"]);
    const [coords, setCoords] = useState(null);
    const [point, setPoint] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    useLayoutEffect(() => {
        let seriesIdx = null;
        config.addHook('init', (u) => {
            u.over.addEventListener('click', (e) => {
                // only open when have a focused point, and not for explicit annotations, zooms, etc.
                if (seriesIdx != null && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                    setCoords({
                        viewport: {
                            x: e.clientX,
                            y: e.clientY,
                        },
                        plotCanvas: {
                            x: e.clientX - u.rect.left,
                            y: e.clientY - u.rect.top,
                        },
                    });
                    setPoint({ seriesIdx, dataIdx: u.cursor.idxs[seriesIdx] });
                    setIsOpen(true);
                }
            });
        });
        config.addHook('setSeries', (u, _seriesIdx) => {
            seriesIdx = _seriesIdx;
        });
    }, [config]);
    const defaultItems = useMemo(() => {
        return otherProps.defaultItems
            ? otherProps.defaultItems.map((i) => {
                return Object.assign(Object.assign({}, i), { items: i.items.map((j) => {
                        return Object.assign(Object.assign({}, j), { onClick: (e) => {
                                var _a;
                                if (!coords) {
                                    return;
                                }
                                (_a = j.onClick) === null || _a === void 0 ? void 0 : _a.call(j, e, { coords });
                            } });
                    }) });
            })
            : [];
    }, [coords, otherProps.defaultItems]);
    return (React.createElement(React.Fragment, null, isOpen && coords && (React.createElement(ContextMenuView, { data: data, frames: otherProps.frames, defaultItems: defaultItems, timeZone: timeZone, selection: { point, coords }, replaceVariables: replaceVariables, onClose: () => {
            setPoint(null);
            setIsOpen(false);
            if (onClose) {
                onClose();
            }
        } }))));
};
export const ContextMenuView = (_a) => {
    var { selection, timeZone, defaultItems, replaceVariables, data } = _a, otherProps = __rest(_a, ["selection", "timeZone", "defaultItems", "replaceVariables", "data"]);
    const ref = useRef(null);
    const onClose = () => {
        if (otherProps.onClose) {
            otherProps.onClose();
        }
    };
    useClickAway(ref, () => {
        onClose();
    });
    const xField = data.fields[0];
    if (!xField) {
        return null;
    }
    const items = defaultItems ? [...defaultItems] : [];
    let renderHeader = () => null;
    if (selection.point) {
        const { seriesIdx, dataIdx } = selection.point;
        const xFieldFmt = xField.display;
        if (seriesIdx && dataIdx !== null) {
            const field = data.fields[seriesIdx];
            const displayValue = field.display(field.values[dataIdx]);
            const hasLinks = field.config.links && field.config.links.length > 0;
            if (hasLinks) {
                if (field.getLinks) {
                    items.push({
                        items: field
                            .getLinks({
                            valueRowIndex: dataIdx,
                        })
                            .map((link) => {
                            return {
                                label: link.title,
                                ariaLabel: link.title,
                                url: link.href,
                                target: link.target,
                                icon: link.target === '_self' ? 'link' : 'external-link-alt',
                                onClick: link.onClick,
                            };
                        }),
                    });
                }
            }
            // eslint-disable-next-line react/display-name
            renderHeader = () => (React.createElement(GraphContextMenuHeader, { timestamp: xFieldFmt(xField.values[dataIdx]).text, displayValue: displayValue, seriesColor: displayValue.color, displayName: getFieldDisplayName(field, data, otherProps.frames) }));
        }
    }
    const renderMenuGroupItems = () => {
        return items === null || items === void 0 ? void 0 : items.map((group, index) => (React.createElement(MenuGroup, { key: `${group.label}${index}`, label: group.label }, (group.items || []).map((item) => (React.createElement(MenuItem, { key: item.label, url: item.url, label: item.label, target: item.target, icon: item.icon, active: item.active, onClick: item.onClick }))))));
    };
    return (React.createElement(ContextMenu, { renderMenuItems: renderMenuGroupItems, renderHeader: renderHeader, x: selection.coords.viewport.x, y: selection.coords.viewport.y, onClose: onClose }));
};
//# sourceMappingURL=ContextMenuPlugin.js.map