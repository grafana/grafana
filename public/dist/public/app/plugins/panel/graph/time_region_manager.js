import 'vendor/flot/jquery.flot';
import { map } from 'lodash';
import { dateTime } from '@grafana/data';
import { config } from 'app/core/config';
import { calculateTimesWithin } from 'app/core/utils/timeRegions';
export const colorModes = {
    gray: {
        themeDependent: true,
        title: 'Gray',
        darkColor: { fill: 'rgba(255, 255, 255, 0.09)', line: 'rgba(255, 255, 255, 0.2)' },
        lightColor: { fill: 'rgba(0, 0, 0, 0.09)', line: 'rgba(0, 0, 0, 0.2)' },
    },
    red: {
        title: 'Red',
        color: { fill: 'rgba(234, 112, 112, 0.12)', line: 'rgba(237, 46, 24, 0.60)' },
    },
    green: {
        title: 'Green',
        color: { fill: 'rgba(11, 237, 50, 0.090)', line: 'rgba(6,163,69, 0.60)' },
    },
    blue: {
        title: 'Blue',
        color: { fill: 'rgba(11, 125, 238, 0.12)', line: 'rgba(11, 125, 238, 0.60)' },
    },
    yellow: {
        title: 'Yellow',
        color: { fill: 'rgba(235, 138, 14, 0.12)', line: 'rgba(247, 149, 32, 0.60)' },
    },
    custom: { title: 'Custom' },
};
export function getColorModes() {
    return map(Object.keys(colorModes), (key) => {
        return {
            key,
            value: colorModes[key].title,
        };
    });
}
function getColor(timeRegion, theme) {
    if (Object.keys(colorModes).indexOf(timeRegion.colorMode) === -1) {
        timeRegion.colorMode = 'red';
    }
    if (timeRegion.colorMode === 'custom') {
        return {
            fill: timeRegion.fill && timeRegion.fillColor ? theme.visualization.getColorByName(timeRegion.fillColor) : null,
            line: timeRegion.line && timeRegion.lineColor ? theme.visualization.getColorByName(timeRegion.lineColor) : null,
        };
    }
    const colorMode = colorModes[timeRegion.colorMode];
    if (colorMode.themeDependent === true) {
        return theme.isLight ? colorMode.lightColor : colorMode.darkColor;
    }
    return {
        fill: timeRegion.fill ? theme.visualization.getColorByName(colorMode.color.fill) : null,
        line: timeRegion.fill ? theme.visualization.getColorByName(colorMode.color.line) : null,
    };
}
export class TimeRegionManager {
    constructor(panelCtrl) {
        this.panelCtrl = panelCtrl;
    }
    draw(plot) {
        this.timeRegions = this.panelCtrl.panel.timeRegions;
        this.plot = plot;
    }
    addFlotOptions(options, panel) {
        var _a;
        if (!((_a = panel.timeRegions) === null || _a === void 0 ? void 0 : _a.length)) {
            return;
        }
        // The panel range
        const tRange = {
            from: dateTime(this.panelCtrl.range.from).utc(),
            to: dateTime(this.panelCtrl.range.to).utc(),
            raw: {
                from: '',
                to: '',
            },
        };
        for (const tr of panel.timeRegions) {
            const timeRegion = tr;
            const regions = calculateTimesWithin(tr, tRange);
            if (regions.length) {
                const timeRegionColor = getColor(timeRegion, config.theme2);
                for (let j = 0; j < regions.length; j++) {
                    const r = regions[j];
                    if (timeRegion.fill) {
                        options.grid.markings.push({
                            xaxis: { from: r.from, to: r.to },
                            color: timeRegionColor.fill,
                        });
                    }
                    if (timeRegion.line) {
                        options.grid.markings.push({
                            xaxis: { from: r.from, to: r.from },
                            color: timeRegionColor.line,
                        });
                        options.grid.markings.push({
                            xaxis: { from: r.to, to: r.to },
                            color: timeRegionColor.line,
                        });
                    }
                }
            }
        }
    }
}
//# sourceMappingURL=time_region_manager.js.map