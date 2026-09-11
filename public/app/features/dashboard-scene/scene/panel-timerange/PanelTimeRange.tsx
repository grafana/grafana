import { css } from '@emotion/css';
import { upperFirst } from 'lodash';

import {
  type DataQueryRequest,
  dateMath,
  getDefaultTimeRange,
  type GrafanaTheme2,
  rangeUtil,
  type TimeRange,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  type ExtraQueryDescriptor,
  type SceneComponentProps,
  type SceneDataQuery,
  sceneGraph,
  type SceneTimeRangeLike,
  type SceneTimeRangeState,
  SceneTimeRangeTransformerBase,
  VariableDependencyConfig,
  VizPanel,
} from '@grafana/scenes';
import { Icon, PanelChrome, Stack, TimePickerTooltip, Tooltip, useStyles2 } from '@grafana/ui';
import { type TimeOverrideResult } from 'app/features/dashboard/utils/panel';

import { getDashboardSceneFor } from '../../utils/utils';

import { PanelTimeRangeDrawer, type PanelTimeRangeZoomBehavior } from './PanelTimeRangeDrawer';
import { getCompareExtraQueries, shouldRerunCompare } from './timeCompare/getCompareExtraQueries';
import { getCompareTimeInfoText } from './timeCompare/options';

export interface PanelTimeRangeState extends SceneTimeRangeState {
  enabled?: boolean;
  timeFrom?: string;
  zoomBehavior?: PanelTimeRangeZoomBehavior;
  timeShift?: string;
  hideTimeOverride?: boolean;
  timeInfo?: string;
  compareWith?: string;
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

  protected _variableDependency: VariableDependencyConfig<PanelTimeRangeState> = new VariableDependencyConfig(this, {
    statePaths: ['timeFrom', 'timeShift'],
  });

  private _onActivate() {
    this._subs.add(
      this.subscribeToState((n) => {
        const { timeInfo, timeRange } = this.getTimeOverride(this.getAncestorTimeRange().state.value);

        // When timeFrom or timeShift is a variable we cannot compare to previous interpolated value
        //   therefore we need to compare timeInfo directly and update when required
        // Note: compare to newState.timeInfo because it is always one behind
        if (n.timeInfo !== timeInfo) {
          this.setState({ timeInfo, value: timeRange });
        }
      })
    );

    const { timeRange } = this.getTimeOverride(this.getAncestorTimeRange().state.value);

    // set initial values on activate
    this.setState({
      value: timeRange,
      from: typeof timeRange.raw.from === 'string' ? timeRange.raw.from : timeRange.raw.from.toISOString(),
      to: typeof timeRange.raw.to === 'string' ? timeRange.raw.to : timeRange.raw.to.toISOString(),
    });
  }

  protected ancestorTimeRangeChanged(timeRange: SceneTimeRangeState): void {
    if (this.state.timeFrom && this.state.zoomBehavior === 'dashboard') {
      return;
    }

    const overrideResult = this.getTimeOverride(timeRange.value);
    const { timeRange: overrideTimeRange } = overrideResult;
    this.setState({
      value: overrideTimeRange,
      timeInfo: overrideResult.timeInfo,
      from:
        typeof overrideTimeRange.raw.from === 'string'
          ? overrideTimeRange.raw.from
          : overrideTimeRange.raw.from.toISOString(),
      to:
        typeof overrideTimeRange.raw.to === 'string'
          ? overrideTimeRange.raw.to
          : overrideTimeRange.raw.to.toISOString(),
    });
  }

  // Get a time shifted request to compare with the primary request.
  // This function name has special handling in scenes, which is why we wrap the util
  public getExtraQueries(request: DataQueryRequest): ExtraQueryDescriptor[] {
    return getCompareExtraQueries(request, this.state.compareWith);
  }

  // The query runner should rerun the comparison query if the compareWith value has changed and there are queries that haven't opted out of time compare
  // This function name has special handling in scenes, which is why we wrap the util
  public shouldRerun(prev: PanelTimeRangeState, next: PanelTimeRangeState, queries: SceneDataQuery[]): boolean {
    return shouldRerunCompare(prev.compareWith, next.compareWith, queries);
  }

  public onTimeRangeChange(timeRange: TimeRange): void {
    const { timeShift } = this.state;

    if (timeShift) {
      const timeShiftInterpolated = sceneGraph.interpolate(this, timeShift);
      const reverseShift = '+' + timeShiftInterpolated;

      const from = dateMath.parseDateMath(reverseShift, timeRange.from, false);
      const to = dateMath.parseDateMath(reverseShift, timeRange.to, true);

      if (from && to) {
        this.getAncestorTimeRange().onTimeRangeChange({
          ...timeRange,
          from,
          to,
          raw: { from, to },
        });
        return;
      }
    }

    this.getAncestorTimeRange().onTimeRangeChange(timeRange);
  }

  private getTimeOverride(parentTimeRange: TimeRange): TimeOverrideResult {
    const { timeFrom, timeShift, compareWith } = this.state;
    const infoBlocks = [];
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
        const timezone = this.getTimeZone();
        newTimeData.timeRange = {
          from: dateMath.toDateTime(timeFromInfo.from, { timezone })!,
          to: dateMath.toDateTime(timeFromInfo.to, { timezone })!,
          raw: { from: timeFromInfo.from, to: timeFromInfo.to },
        };
        infoBlocks.push(timeFromInfo.display);
      }
    }

    if (timeShift) {
      const timeShiftInterpolated = sceneGraph.interpolate(this, this.state.timeShift);
      const timeShiftInfo = rangeUtil.describeTextRange(timeShiftInterpolated);

      if (timeShiftInfo.invalid) {
        newTimeData.timeInfo = 'invalid timeshift';
        return newTimeData;
      }

      const shift = '-' + timeShiftInterpolated;
      infoBlocks.push('timeshift ' + shift);

      if (rangeUtil.isRelativeTimeRange(newTimeData.timeRange.raw)) {
        const timezone = this.getTimeZone();

        const rawFromShifted = `${newTimeData.timeRange.raw.from}${shift}`;
        const rawToShifted = `${newTimeData.timeRange.raw.to}${shift}`;

        const from = dateMath.toDateTime(rawFromShifted, { timezone });
        const to = dateMath.toDateTime(rawToShifted, { timezone, roundUp: true });

        if (!from || !to) {
          newTimeData.timeInfo = 'invalid timeshift';
          return newTimeData;
        }

        newTimeData.timeRange = {
          from,
          to,
          raw: { from: rawFromShifted, to: rawToShifted },
        };
      } else {
        const from = dateMath.parseDateMath(shift, newTimeData.timeRange.from, false);
        const to = dateMath.parseDateMath(shift, newTimeData.timeRange.to, true);

        if (!from || !to) {
          newTimeData.timeInfo = 'invalid timeshift';
          return newTimeData;
        }

        newTimeData.timeRange = { from, to, raw: { from, to } };
      }
    }

    if (compareWith) {
      infoBlocks.push(getCompareTimeInfoText(compareWith));
    }

    newTimeData.timeInfo = upperFirst(infoBlocks.join(' + '));
    return newTimeData;
  }

  public onOpenSettings = () => {
    const panel = this.parent;
    const dashboard = getDashboardSceneFor(this);
    if (panel instanceof VizPanel) {
      dashboard.showModal(new PanelTimeRangeDrawer({ panelRef: panel.getRef() }));
    }
  };
}

function PanelTimeRangeRenderer({ model }: SceneComponentProps<PanelTimeRange>) {
  const { timeInfo, hideTimeOverride } = model.useState();
  const styles = useStyles2(getStyles);

  if (!timeInfo || hideTimeOverride) {
    return null;
  }

  const onClick = config.featureToggles.panelTimeSettings ? model.onOpenSettings : undefined;

  return (
    <Tooltip content={<TimePickerTooltip timeRange={model.state.value} timeZone={model.getTimeZone()} />}>
      <PanelChrome.TitleItem className={styles.timeshift} onClick={onClick}>
        <Stack gap={1} alignItems={'center'}>
          <Icon name="clock-nine" size="sm" />
          <div>{timeInfo}</div>
        </Stack>
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
