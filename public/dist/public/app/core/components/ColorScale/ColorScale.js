import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';
import { useTheme2 } from '@grafana/ui';
const GRADIENT_STOPS = 10;
export const ColorScale = ({ colorPalette, min, max, display, hoverValue, useStopsPercentage }) => {
    const [colors, setColors] = useState([]);
    const [scaleHover, setScaleHover] = useState({ isShown: false, value: 0 });
    const [percent, setPercent] = useState(null); // 0-100 for CSS percentage
    const theme = useTheme2();
    const styles = getStyles(theme, colors);
    useEffect(() => {
        setColors(getGradientStops({ colorArray: colorPalette, stops: GRADIENT_STOPS, useStopsPercentage }));
    }, [colorPalette, useStopsPercentage]);
    const onScaleMouseMove = (event) => {
        const divOffset = event.nativeEvent.offsetX;
        const offsetWidth = event.currentTarget.offsetWidth;
        const normPercentage = Math.floor((divOffset * 100) / offsetWidth + 1);
        const scaleValue = Math.floor(((max - min) * normPercentage) / 100 + min);
        setScaleHover({ isShown: true, value: scaleValue });
        setPercent(normPercentage);
    };
    const onScaleMouseLeave = () => {
        setScaleHover({ isShown: false, value: 0 });
    };
    useEffect(() => {
        setPercent(hoverValue == null ? null : clampPercent100((hoverValue - min) / (max - min)));
    }, [hoverValue, min, max]);
    return (React.createElement("div", { className: styles.scaleWrapper, onMouseMove: onScaleMouseMove, onMouseLeave: onScaleMouseLeave },
        React.createElement("div", { className: styles.scaleGradient }, display && (scaleHover.isShown || hoverValue !== undefined) && (React.createElement("div", { className: styles.followerContainer },
            React.createElement("div", { className: styles.follower, style: { left: `${percent}%` } })))),
        display && (React.createElement("div", { className: styles.followerContainer },
            React.createElement("div", { className: styles.legendValues },
                React.createElement("span", null, display(min)),
                React.createElement("span", null, display(max))),
            percent != null && (scaleHover.isShown || hoverValue !== undefined) && (React.createElement("span", { className: styles.hoverValue, style: { left: `${percent}%` } }, display(hoverValue !== null && hoverValue !== void 0 ? hoverValue : scaleHover.value)))))));
};
const getGradientStops = ({ colorArray, stops, useStopsPercentage = true, }) => {
    const colorCount = colorArray.length;
    if (useStopsPercentage && colorCount <= 20) {
        const incr = (1 / colorCount) * 100;
        let per = 0;
        const stops = [];
        for (const color of colorArray) {
            if (per > 0) {
                stops.push(`${color} ${per}%`);
            }
            else {
                stops.push(color);
            }
            per += incr;
            stops.push(`${color} ${per}%`);
        }
        return stops;
    }
    const gradientEnd = colorArray[colorCount - 1];
    const skip = Math.ceil(colorCount / stops);
    const gradientStops = new Set();
    for (let i = 0; i < colorCount; i += skip) {
        gradientStops.add(colorArray[i]);
    }
    gradientStops.add(gradientEnd);
    return [...gradientStops];
};
function clampPercent100(v) {
    if (v > 1) {
        return 100;
    }
    if (v < 0) {
        return 0;
    }
    return v * 100;
}
const getStyles = (theme, colors) => ({
    scaleWrapper: css `
    width: 100%;
    font-size: 11px;
    opacity: 1;
  `,
    scaleGradient: css `
    background: linear-gradient(90deg, ${colors.join()});
    height: 10px;
    pointer-events: none;
  `,
    legendValues: css `
    display: flex;
    justify-content: space-between;
    pointer-events: none;
  `,
    hoverValue: css `
    position: absolute;
    margin-top: -14px;
    padding: 3px 15px;
    background: ${theme.colors.background.primary};
    transform: translateX(-50%);
  `,
    followerContainer: css `
    position: relative;
    pointer-events: none;
    white-space: nowrap;
  `,
    follower: css `
    position: absolute;
    height: 14px;
    width: 14px;
    border-radius: 50%;
    transform: translateX(-50%) translateY(-50%);
    border: 2px solid ${theme.colors.text.primary};
    margin-top: 5px;
  `,
});
//# sourceMappingURL=ColorScale.js.map