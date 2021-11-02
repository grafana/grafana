import { __read } from "tslib";
import { useEffect, useLayoutEffect, useState } from 'react';
import { pluginLog } from '../utils';
// min px width that triggers zoom
var MIN_ZOOM_DIST = 5;
/**
 * @alpha
 */
export var ZoomPlugin = function (_a) {
    var onZoom = _a.onZoom, config = _a.config;
    var _b = __read(useState(null), 2), selection = _b[0], setSelection = _b[1];
    useEffect(function () {
        if (selection) {
            pluginLog('ZoomPlugin', false, 'selected', selection);
            if (selection.bbox.width < MIN_ZOOM_DIST) {
                return;
            }
            onZoom({ from: selection.min, to: selection.max });
        }
    }, [selection]);
    useLayoutEffect(function () {
        config.addHook('setSelect', function (u) {
            var min = u.posToVal(u.select.left, 'x');
            var max = u.posToVal(u.select.left + u.select.width, 'x');
            setSelection({
                min: min,
                max: max,
                bbox: {
                    left: u.bbox.left / window.devicePixelRatio + u.select.left,
                    top: u.bbox.top / window.devicePixelRatio,
                    height: u.bbox.height / window.devicePixelRatio,
                    width: u.select.width,
                },
            });
            // manually hide selected region (since cursor.drag.setScale = false)
            /* @ts-ignore */
            u.setSelect({ left: 0, width: 0 }, false);
        });
    }, [config]);
    return null;
};
//# sourceMappingURL=ZoomPlugin.js.map