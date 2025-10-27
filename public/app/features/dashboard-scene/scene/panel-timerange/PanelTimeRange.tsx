import { css } from '@emotion/css';
import { capitalize } from 'lodash';

import { DataQueryRequest, dateMath, getDefaultTimeRange, GrafanaTheme2, rangeUtil, TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  ExtraQueryDescriptor,
  SceneComponentProps,
  SceneDataQuery,
  sceneGraph,
  SceneTimeRangeLike,
  SceneTimeRangeState,
  SceneTimeRangeTransformerBase,
  VariableDependencyConfig,
  VizPanel,
} from '@grafana/scenes';
import { Icon, PanelChrome, Stack, TimePickerTooltip, Tooltip, useStyles2 } from '@grafana/ui';
import { TimeOverrideResult } from 'app/features/dashboard/utils/panel';

import { getDashboardSceneFor } from '../../utils/utils';

import { DEFAULT_COMPARE_OPTIONS, PanelTimeRangeDrawer, PanelTimeRangeZoomBehavior } from './PanelTimeRangeDrawer';
import { getCompareTimeRange, timeShiftAlignmentProcessor } from './utils';

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
      from: timeRange.raw.from.toString(),
      to: timeRange.raw.to.toString(),
    });
  }

  protected ancestorTimeRangeChanged(timeRange: SceneTimeRangeState): void {
    if (this.state.timeFrom && this.state.zoomBehavior === 'dashboard') {
      return;
    }

    const overrideResult = this.getTimeOverride(timeRange.value);
    this.setState({ value: overrideResult.timeRange, timeInfo: overrideResult.timeInfo });
  }

  // Get a time shifted request to compare with the primary request.
  public getExtraQueries(request: DataQueryRequest): ExtraQueryDescriptor[] {
    const extraQueries: ExtraQueryDescriptor[] = [];
    const compareRange = getCompareTimeRange(request.range, this.state.compareWith);
    if (!compareRange) {
      return extraQueries;
    }

    const targets = request.targets.filter((query: SceneDataQuery) => query.timeRangeCompare !== false);
    if (targets.length) {
      extraQueries.push({
        req: {
          ...request,
          targets,
          range: compareRange,
        },
        processor: timeShiftAlignmentProcessor,
      });
    }
    return extraQueries;
  }

  // The query runner should rerun the comparison query if the compareWith value has changed and there are queries that haven't opted out of TWC
  public shouldRerun(prev: PanelTimeRangeState, next: PanelTimeRangeState, queries: SceneDataQuery[]): boolean {
    return (
      prev.compareWith !== next.compareWith && queries.find((query) => query.timeRangeCompare !== false) !== undefined
    );
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
        const timeZone = this.getTimeZone();
        newTimeData.timeRange = {
          from: dateMath.parse(timeFromInfo.from, undefined, timeZone)!,
          to: dateMath.parse(timeFromInfo.to, undefined, timeZone)!,
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

      const timeShift = '-' + timeShiftInterpolated;
      infoBlocks.push('timeshift ' + timeShift);

      const from = dateMath.parseDateMath(timeShift, newTimeData.timeRange.from, false)!;
      const to = dateMath.parseDateMath(timeShift, newTimeData.timeRange.to, true)!;

      if (!from || !to) {
        newTimeData.timeInfo = 'invalid timeshift';
        return newTimeData;
      }

      newTimeData.timeRange = { from, to, raw: { from, to } };
    }

    if (compareWith) {
      const option = DEFAULT_COMPARE_OPTIONS.find((x) => x.value === compareWith);
      const text = option ? `compared to ${option.label.toLowerCase()}` : '';
      infoBlocks.push(text);
    }

    newTimeData.timeInfo = capitalize(infoBlocks.join(', '));
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
