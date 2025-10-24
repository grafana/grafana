/* eslint @grafana/i18n/no-untranslated-strings: 0 */
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { useState } from 'react';
import { of } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  dateMath,
  dateTime,
  DateTime,
  getDefaultTimeRange,
  GrafanaTheme2,
  rangeUtil,
  TimeRange,
} from '@grafana/data';
import {
  ExtraQueryDataProcessor,
  ExtraQueryDescriptor,
  SceneComponentProps,
  SceneDataQuery,
  sceneGraph,
  SceneTimeRangeLike,
  SceneTimeRangeState,
  SceneTimeRangeTransformerBase,
  VariableDependencyConfig,
} from '@grafana/scenes';
import {
  Badge,
  Box,
  Button,
  Drawer,
  Icon,
  Input,
  Label,
  PanelChrome,
  Stack,
  TimePickerTooltip,
  Tooltip,
  Field,
  useStyles2,
  Combobox,
} from '@grafana/ui';
import { TimeOverrideResult } from 'app/features/dashboard/utils/panel';

export interface PanelTimeRangeState extends SceneTimeRangeState {
  enabled?: boolean;
  timeFrom?: string;
  timeShift?: string;
  hideTimeOverride?: boolean;
  timeInfo?: string;
  compareWith?: string;
  isSettingsOpen?: boolean;
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
      const final = infoBlocks.length === 0 ? capitalize(text) : text;
      infoBlocks.push(final);
    }

    newTimeData.timeInfo = infoBlocks.join(' + ');
    return newTimeData;
  }
}

function PanelTimeRangeRenderer({ model }: SceneComponentProps<PanelTimeRange>) {
  const { timeInfo, hideTimeOverride, isSettingsOpen } = model.useState();
  const styles = useStyles2(getStyles);

  if (!timeInfo || hideTimeOverride) {
    return null;
  }

  return (
    <>
      {isSettingsOpen && (
        <Drawer title="Panel time range settings" onClose={() => model.setState({ isSettingsOpen: false })} size="sm">
          <PanelTimeRangeSettings model={model} />
        </Drawer>
      )}
      <Tooltip content={'Click to open panel time range settings'}>
        <PanelChrome.TitleItem className={styles.timeshift} onClick={() => model.setState({ isSettingsOpen: true })}>
          <Stack gap={1} alignItems={'center'}>
            <Icon name="clock-nine" size="sm" />
            <div>{timeInfo}</div>
          </Stack>
        </PanelChrome.TitleItem>
      </Tooltip>
    </>
  );
}

const DEFAULT_COMPARE_OPTIONS = [
  { label: 'Disabled', value: '' },
  { label: 'Day before', value: '24h' },
  { label: 'Week before', value: '1w' },
  { label: 'Month before', value: '1M' },
];

function PanelTimeRangeSettings({ model }: SceneComponentProps<PanelTimeRange>) {
  const { timeFrom, timeShift, hideTimeOverride, compareWith } = model.useState();
  const [localTimeFrom, setLocalTimeFrom] = useState(timeFrom);
  const [localTimeShift, setLocalTimeShift] = useState(timeShift);
  const [localHideTimeOverride, setLocalHideTimeOverride] = useState(hideTimeOverride);
  const [timeCompare, setTimeCompare] = useState(compareWith ?? '');

  return (
    <Stack direction="column" gap={2}>
      <Field label="Relative time override" noMargin>
        <Input
          value={localTimeFrom}
          onChange={(e) => setLocalTimeFrom(e.currentTarget.value)}
          placeholder="e.g. now-1h"
        />
      </Field>
      <Field label="Time shift" noMargin>
        <Input
          value={localTimeShift}
          onChange={(e) => setLocalTimeShift(e.currentTarget.value)}
          placeholder="e.g. 1h"
        />
      </Field>
      <Field
        noMargin
        label={
          <Stack>
            <Label>Time window comparison</Label> <Badge color="blue" text="New" />
          </Stack>
        }
      >
        <Combobox options={DEFAULT_COMPARE_OPTIONS} value={timeCompare} onChange={(x) => setTimeCompare(x.value)} />
      </Field>

      <Box paddingTop={3}>
        <Stack>
          <Button variant="secondary" onClick={() => model.setState({ isSettingsOpen: false })}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              model.setState({
                timeFrom: localTimeFrom,
                timeShift: localTimeShift,
                hideTimeOverride: localHideTimeOverride,
                isSettingsOpen: false,
                compareWith: timeCompare,
              });
            }}
          >
            Apply
          </Button>
        </Stack>
      </Box>
    </Stack>
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

const PREVIOUS_PERIOD_VALUE = '__previousPeriod';
const NO_PERIOD_VALUE = '__noPeriod';

function getCompareTimeRange(timeRange: TimeRange, compareWith: string | undefined): TimeRange | undefined {
  let compareFrom: DateTime;
  let compareTo: DateTime;

  if (compareWith) {
    if (compareWith === PREVIOUS_PERIOD_VALUE) {
      const diffMs = timeRange.to.diff(timeRange.from);
      compareFrom = dateTime(timeRange.from!).subtract(diffMs);
      compareTo = dateTime(timeRange.to!).subtract(diffMs);
    } else {
      compareFrom = dateTime(timeRange.from!).subtract(rangeUtil.intervalToMs(compareWith));
      compareTo = dateTime(timeRange.to!).subtract(rangeUtil.intervalToMs(compareWith));
    }
    return {
      from: compareFrom,
      to: compareTo,
      raw: {
        from: compareFrom,
        to: compareTo,
      },
    };
  }

  return undefined;
}

// Processor function for use with time shifted comparison series.
// This aligns the secondary series with the primary and adds custom
// metadata and config to the secondary series' fields so that it is
// rendered appropriately.
const timeShiftAlignmentProcessor: ExtraQueryDataProcessor = (primary, secondary) => {
  const diff = secondary.timeRange.from.diff(primary.timeRange.from);
  secondary.series.forEach((series) => {
    series.refId = getCompareSeriesRefId(series.refId || '');
    series.meta = {
      ...series.meta,
      // @ts-ignore Remove when https://github.com/grafana/grafana/pull/71129 is released
      timeCompare: {
        diffMs: diff,
        isTimeShiftQuery: true,
      },
    };
  });
  return of(secondary);
};

export const getCompareSeriesRefId = (refId: string) => `${refId}-compare`;
