import { css } from '@emotion/css';
import React from 'react';

import { dateMath, getDefaultTimeRange, GrafanaTheme2, rangeUtil, TimeRange } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneTimeRangeLike,
  SceneTimeRangeState,
} from '@grafana/scenes';
import { Icon, PanelChrome, TimePickerTooltip, Tooltip, useStyles2 } from '@grafana/ui';
import { TimeOverrideResult } from 'app/features/dashboard/utils/panel';

interface PanelTimeRangeState extends SceneTimeRangeState {
  timeFrom?: string;
  timeShift?: string;
  //hideTimeOverride
  timeInfo?: string;
}

export class PanelTimeRange extends SceneObjectBase<PanelTimeRangeState> implements SceneTimeRangeLike {
  public static Component = PanelTimeRangeRenderer;

  public constructor(state: Partial<PanelTimeRangeState> = {}) {
    super({
      ...state,
      // This time range is not valid until activation
      from: 'now-6h',
      to: 'now',
      value: getDefaultTimeRange(),
    });

    this.addActivationHandler(() => this._activationHandler());
  }

  private getTimeOverride(parentTimeRange: TimeRange): TimeOverrideResult {
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
          from: dateMath.parse(timeFromInfo.from)!,
          to: dateMath.parse(timeFromInfo.to)!,
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
      const from = dateMath.parseDateMath(timeShift, newTimeData.timeRange.from, false)!;
      const to = dateMath.parseDateMath(timeShift, newTimeData.timeRange.to, true)!;

      newTimeData.timeRange = { from, to, raw: { from, to } };
    }

    return newTimeData;
  }

  private _activationHandler(): void {
    const parentTimeRange = this.getParentTimeRange();

    this._subs.add(parentTimeRange.subscribeToState((state) => this.handleParentTimeRangeChanged(state.value)));

    this.handleParentTimeRangeChanged(parentTimeRange.state.value);
  }

  private handleParentTimeRangeChanged(parentTimeRange: TimeRange) {
    const overrideResult = this.getTimeOverride(parentTimeRange);
    this.setState({ value: overrideResult.timeRange, timeInfo: overrideResult.timeInfo });
  }

  private getParentTimeRange(): SceneTimeRangeLike {
    if (!this.parent || !this.parent.parent) {
      throw new Error('Missing parent');
    }

    // Need to go up two levels otherwise we will get ourselves
    return sceneGraph.getTimeRange(this.parent.parent);
  }

  public onTimeRangeChange = (timeRange: TimeRange) => {
    const parentTimeRange = this.getParentTimeRange();
    parentTimeRange.onTimeRangeChange(timeRange);
  };

  public onRefresh(): void {
    this.getParentTimeRange().onRefresh();
  }

  public onTimeZoneChange(timeZone: string): void {
    this.getParentTimeRange().onTimeZoneChange(timeZone);
  }

  public getTimeZone(): string {
    return this.getParentTimeRange().getTimeZone();
  }
}

function PanelTimeRangeRenderer({ model }: SceneComponentProps<PanelTimeRange>) {
  const { timeInfo } = model.useState();
  const styles = useStyles2(getStyles);

  if (!timeInfo) {
    return null;
  }

  return (
    <Tooltip content={<TimePickerTooltip timeRange={model.state.value} timeZone={model.getTimeZone()} />}>
      <PanelChrome.TitleItem className={styles.timeshift}>
        <Icon name="clock-nine" size="sm" /> {timeInfo}
      </PanelChrome.TitleItem>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    timeshift: css({
      color: theme.colors.text.link,
      gap: theme.spacing(0.5),
    }),
  };
};
