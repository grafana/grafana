import { css } from '@emotion/css';
import React from 'react';
import { dateMath, getDefaultTimeRange, rangeUtil } from '@grafana/data';
import { sceneGraph, SceneTimeRangeTransformerBase, } from '@grafana/scenes';
import { Icon, PanelChrome, TimePickerTooltip, Tooltip, useStyles2 } from '@grafana/ui';
export class PanelTimeRange extends SceneTimeRangeTransformerBase {
    constructor(state = {}) {
        super(Object.assign(Object.assign({}, state), { 
            // This time range is not valid until activation
            from: 'now-6h', to: 'now', value: getDefaultTimeRange() }));
    }
    ancestorTimeRangeChanged(timeRange) {
        const overrideResult = this.getTimeOverride(timeRange.value);
        this.setState({ value: overrideResult.timeRange, timeInfo: overrideResult.timeInfo });
    }
    getTimeOverride(parentTimeRange) {
        const { timeFrom, timeShift } = this.state;
        const newTimeData = { timeInfo: '', timeRange: parentTimeRange };
        if (timeFrom) {
            const timeFromInterpolated = sceneGraph.interpolate(this, this.state.timeFrom);
            const timeFromInfo = rangeUtil.describeTextRange(timeFromInterpolated);
            if (timeFromInfo.invalid) {
                newTimeData.timeInfo = 'invalid time override';
                return newTimeData;
            }
            // Only evaluate if the timeFrom if parent time is relative
            if (rangeUtil.isRelativeTimeRange(parentTimeRange.raw)) {
                newTimeData.timeInfo = timeFromInfo.display;
                newTimeData.timeRange = {
                    from: dateMath.parse(timeFromInfo.from),
                    to: dateMath.parse(timeFromInfo.to),
                    raw: { from: timeFromInfo.from, to: timeFromInfo.to },
                };
            }
        }
        if (timeShift) {
            const timeShiftInterpolated = sceneGraph.interpolate(this, this.state.timeShift);
            const timeShiftInfo = rangeUtil.describeTextRange(timeShiftInterpolated);
            if (timeShiftInfo.invalid) {
                newTimeData.timeInfo = 'invalid timeshift';
                return newTimeData;
            }
            const timeShift = '-' + timeShiftInterpolated;
            newTimeData.timeInfo += ' timeshift ' + timeShift;
            const from = dateMath.parseDateMath(timeShift, newTimeData.timeRange.from, false);
            const to = dateMath.parseDateMath(timeShift, newTimeData.timeRange.to, true);
            newTimeData.timeRange = { from, to, raw: { from, to } };
        }
        return newTimeData;
    }
}
PanelTimeRange.Component = PanelTimeRangeRenderer;
function PanelTimeRangeRenderer({ model }) {
    const { timeInfo, hideTimeOverride } = model.useState();
    const styles = useStyles2(getStyles);
    if (!timeInfo || hideTimeOverride) {
        return null;
    }
    return (React.createElement(Tooltip, { content: React.createElement(TimePickerTooltip, { timeRange: model.state.value, timeZone: model.getTimeZone() }) },
        React.createElement(PanelChrome.TitleItem, { className: styles.timeshift },
            React.createElement(Icon, { name: "clock-nine", size: "sm" }),
            " ",
            timeInfo)));
}
const getStyles = (theme) => {
    return {
        timeshift: css({
            color: theme.colors.text.link,
            gap: theme.spacing(0.5),
        }),
    };
};
//# sourceMappingURL=PanelTimeRange.js.map