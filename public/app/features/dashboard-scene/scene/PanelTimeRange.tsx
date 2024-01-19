import { css } from '@emotion/css';
import React from 'react';

import { dateMath, getDefaultTimeRange, GrafanaTheme2, rangeUtil, TimeRange } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneTimeRangeLike,
  SceneTimeRangeState,
  SceneTimeRangeTransformerBase,
} from '@grafana/scenes';
import { Icon, PanelChrome, TimePickerTooltip, Tooltip, useStyles2 } from '@grafana/ui';
import { TimeOverrideResult } from 'app/features/dashboard/utils/panel';

export interface PanelTimeRangeState extends SceneTimeRangeState {
  timeFrom?: string;
  timeShift?: string;
  hideTimeOverride?: boolean;
  timeInfo?: string;
}

export class PanelTimeRange extends SceneTimeRangeTransformerBase<PanelTimeRangeState> implements SceneTimeRangeLike {
  public static Component = PanelTimeRangeRenderer;

  public constructor(state: Partial<PanelTimeRangeState> = {}) {
    super({
      ...state,
      // This time range is not valid until activation
      from: 'now-6h',
      to: 'now',
      value: getDefaultTimeRange(),
    });

    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    this._subs.add(
      this.subscribeToState((n, p) => {
        // Listen to own changes and update time info when required
        if (n.timeFrom !== p.timeFrom || n.timeShift !== p.timeShift) {
          const { timeInfo } = this.getTimeOverride(this.getAncestorTimeRange().state.value);
          this.setState({ timeInfo });
        }
      })
    );
  }
  protected ancestorTimeRangeChanged(timeRange: SceneTimeRangeState): void {
    const overrideResult = this.getTimeOverride(timeRange.value);
    this.setState({ value: overrideResult.timeRange, timeInfo: overrideResult.timeInfo });
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
}

function PanelTimeRangeRenderer({ model }: SceneComponentProps<PanelTimeRange>) {
  const { timeInfo, hideTimeOverride } = model.useState();
  const styles = useStyles2(getStyles);

  if (!timeInfo || hideTimeOverride) {
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
      whiteSpace: 'nowrap',
    }),
  };
};
