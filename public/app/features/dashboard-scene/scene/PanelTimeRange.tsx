import { css } from '@emotion/css';
import React from 'react';

import { dateMath, getTimeZone, GrafanaTheme2, rangeUtil, TimeRange } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneTimeRangeLike,
  SceneTimeRangeState,
} from '@grafana/scenes';
import { TimeZone } from '@grafana/schema';
import { Icon, PanelChrome, TimePickerTooltip, Tooltip, useStyles2 } from '@grafana/ui';
import { TimeOverrideResult } from 'app/features/dashboard/utils/panel';

interface PanelTimeRangeState extends SceneTimeRangeState {
  timeFrom?: string;
  timeShift?: string;
}

export class PanelTimeRange extends SceneObjectBase<PanelTimeRangeState> implements SceneTimeRangeLike {
  public static Component = PanelTimeRangeRenderer;

  private overrideResult: TimeOverrideResult | null = null;

  public constructor(state: Partial<PanelTimeRangeState> = {}) {
    const from = state.from ?? 'now-6h';
    const to = state.to ?? 'now';
    const timeZone = state.timeZone ?? getTimeZone();
    const value = evaluateTimeRange(from, to, timeZone);
    super({ from, to, timeZone, value, ...state });

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
    this.overrideResult = this.getTimeOverride(parentTimeRange);
    this.setState({ value: this.overrideResult.timeRange });
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

  public getOverrideInfo(): string | undefined {
    return this.overrideResult?.timeInfo;
  }
}

function evaluateTimeRange(from: string, to: string, timeZone: TimeZone, fiscalYearStartMonth?: number): TimeRange {
  return {
    from: dateMath.parse(from, false, timeZone, fiscalYearStartMonth)!,
    to: dateMath.parse(to, true, timeZone, fiscalYearStartMonth)!,
    raw: {
      from: from,
      to: to,
    },
  };
}

function PanelTimeRangeRenderer({ model }: SceneComponentProps<PanelTimeRange>) {
  const timeInfo = model.getOverrideInfo();
  const styles = useStyles2(getStyles);

  if (!timeInfo) {
    return null;
  }

  return (
    <Tooltip content={<TimePickerTooltip timeRange={model.state.value} timeZone={model.getTimeZone()} />}>
      <PanelChrome.TitleItem className={styles.timeshift}>
        <Icon name="clock-nine" size="sm" /> {model.getOverrideInfo()}
      </PanelChrome.TitleItem>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    timeshift: css({
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
      gap: theme.spacing(0.5),
    }),
  };
};
