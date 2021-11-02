import { __read, __spreadArray } from "tslib";
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useMountedState } from 'react-use';
import { AnnotationEditor } from './annotations/AnnotationEditor';
/**
 * @alpha
 */
export var AnnotationEditorPlugin = function (_a) {
    var data = _a.data, timeZone = _a.timeZone, config = _a.config, children = _a.children;
    var plotInstance = useRef();
    var _b = __read(useState(), 2), bbox = _b[0], setBbox = _b[1];
    var _c = __read(useState(false), 2), isAddingAnnotation = _c[0], setIsAddingAnnotation = _c[1];
    var _d = __read(useState(null), 2), selection = _d[0], setSelection = _d[1];
    var isMounted = useMountedState();
    var clearSelection = useCallback(function () {
        setSelection(null);
        if (plotInstance.current) {
            plotInstance.current.setSelect({ top: 0, left: 0, width: 0, height: 0 });
        }
        setIsAddingAnnotation(false);
    }, [setIsAddingAnnotation, setSelection]);
    useLayoutEffect(function () {
        var annotating = false;
        config.addHook('init', function (u) {
            plotInstance.current = u;
            // Wrap all setSelect hooks to prevent them from firing if user is annotating
            var setSelectHooks = u.hooks.setSelect;
            if (setSelectHooks) {
                var _loop_1 = function (i) {
                    var hook = setSelectHooks[i];
                    if (hook !== setSelect) {
                        setSelectHooks[i] = function () {
                            var args = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                args[_i] = arguments[_i];
                            }
                            !annotating && hook.apply(void 0, __spreadArray([], __read(args), false));
                        };
                    }
                };
                for (var i = 0; i < setSelectHooks.length; i++) {
                    _loop_1(i);
                }
            }
        });
        // cache uPlot plotting area bounding box
        config.addHook('syncRect', function (u, rect) {
            if (!isMounted()) {
                return;
            }
            setBbox(rect);
        });
        var setSelect = function (u) {
            if (annotating) {
                setIsAddingAnnotation(true);
                setSelection({
                    min: u.posToVal(u.select.left, 'x'),
                    max: u.posToVal(u.select.left + u.select.width, 'x'),
                    bbox: {
                        left: u.select.left,
                        top: 0,
                        height: u.select.height,
                        width: u.select.width,
                    },
                });
                annotating = false;
            }
        };
        config.addHook('setSelect', setSelect);
        config.setCursor({
            bind: {
                mousedown: function (u, targ, handler) { return function (e) {
                    annotating = e.button === 0 && (e.metaKey || e.ctrlKey);
                    handler(e);
                    return null;
                }; },
                mouseup: function (u, targ, handler) { return function (e) {
                    // uPlot will not fire setSelect hooks for 0-width && 0-height selections
                    // so we force it to fire on single-point clicks by mutating left & height
                    if (annotating && u.select.width === 0) {
                        u.select.left = u.cursor.left;
                        u.select.height = u.bbox.height / window.devicePixelRatio;
                    }
                    handler(e);
                    return null;
                }; },
            },
        });
    }, [config, setBbox, isMounted]);
    var startAnnotating = useCallback(function (_a) {
        var coords = _a.coords;
        if (!plotInstance.current || !bbox || !coords) {
            return;
        }
        var min = plotInstance.current.posToVal(coords.plotCanvas.x, 'x');
        if (!min) {
            return;
        }
        setSelection({
            min: min,
            max: min,
            bbox: {
                left: coords.plotCanvas.x,
                top: 0,
                height: bbox.height,
                width: 0,
            },
        });
        setIsAddingAnnotation(true);
    }, [bbox]);
    return (React.createElement(React.Fragment, null,
        isAddingAnnotation && selection && bbox && (React.createElement(AnnotationEditor, { selection: selection, onDismiss: clearSelection, onSave: clearSelection, data: data, timeZone: timeZone, style: {
                position: 'absolute',
                top: bbox.top + "px",
                left: bbox.left + "px",
                width: bbox.width + "px",
                height: bbox.height + "px",
            } })),
        children ? children({ startAnnotating: startAnnotating }) : null));
};
//# sourceMappingURL=AnnotationEditorPlugin.js.map