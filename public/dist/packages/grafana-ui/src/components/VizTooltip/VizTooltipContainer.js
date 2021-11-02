import { __assign, __makeTemplateObject, __read, __rest, __values } from "tslib";
import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { getTooltipContainerStyles } from '../../themes/mixins';
import useWindowSize from 'react-use/lib/useWindowSize';
import { calculateTooltipPosition } from './utils';
/**
 * @public
 */
export var VizTooltipContainer = function (_a) {
    var _b = _a.position, positionX = _b.x, positionY = _b.y, _c = _a.offset, offsetX = _c.x, offsetY = _c.y, children = _a.children, className = _a.className, otherProps = __rest(_a, ["position", "offset", "children", "className"]);
    var tooltipRef = useRef(null);
    var _d = __read(useState({ width: 0, height: 0 }), 2), tooltipMeasurement = _d[0], setTooltipMeasurement = _d[1];
    var _e = useWindowSize(), width = _e.width, height = _e.height;
    var _f = __read(useState({
        x: positionX + offsetX,
        y: positionY + offsetY,
    }), 2), placement = _f[0], setPlacement = _f[1];
    var resizeObserver = useMemo(function () {
        // TS has hard time playing games with @types/resize-observer-browser, hence the ignore
        // @ts-ignore
        return new ResizeObserver(function (entries) {
            var e_1, _a;
            try {
                for (var entries_1 = __values(entries), entries_1_1 = entries_1.next(); !entries_1_1.done; entries_1_1 = entries_1.next()) {
                    var entry = entries_1_1.value;
                    var tW = Math.floor(entry.contentRect.width + 2 * 8); //  adding padding until Safari supports borderBoxSize
                    var tH = Math.floor(entry.contentRect.height + 2 * 8);
                    if (tooltipMeasurement.width !== tW || tooltipMeasurement.height !== tH) {
                        setTooltipMeasurement({
                            width: tW,
                            height: tH,
                        });
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (entries_1_1 && !entries_1_1.done && (_a = entries_1.return)) _a.call(entries_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }, [tooltipMeasurement]);
    useLayoutEffect(function () {
        if (tooltipRef.current) {
            resizeObserver.observe(tooltipRef.current);
        }
        return function () {
            resizeObserver.disconnect();
        };
    }, [resizeObserver]);
    // Make sure tooltip does not overflow window
    useLayoutEffect(function () {
        if (tooltipRef && tooltipRef.current) {
            var _a = calculateTooltipPosition(positionX, positionY, tooltipMeasurement.width, tooltipMeasurement.height, offsetX, offsetY, width, height), x = _a.x, y = _a.y;
            setPlacement({ x: x, y: y });
        }
    }, [width, height, positionX, offsetX, positionY, offsetY, tooltipMeasurement]);
    var styles = useStyles2(getStyles);
    return (React.createElement("div", __assign({ ref: tooltipRef, style: {
            position: 'fixed',
            left: 0,
            // disabling pointer-events is to prevent the tooltip from flickering when moving left to right
            // see e.g. https://github.com/grafana/grafana/pull/33609
            pointerEvents: 'none',
            top: 0,
            transform: "translate(" + placement.x + "px, " + placement.y + "px)",
            transition: 'transform ease-out 0.1s',
        } }, otherProps, { className: cx(styles.wrapper, className) }), children));
};
VizTooltipContainer.displayName = 'VizTooltipContainer';
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    ", "\n  "], ["\n    ", "\n  "])), getTooltipContainerStyles(theme)),
}); };
var templateObject_1;
//# sourceMappingURL=VizTooltipContainer.js.map