import { type AbsoluteTimeRange, type TimeRange, type TimeZone, dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RefreshPicker, Stack, TimeRangePicker, ToolbarButton } from '@grafana/ui';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';

interface Props {
  timeRange: TimeRange;
  timeZone: TimeZone;
  refreshInterval: string;
  onChangeTimeRange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeRefreshInterval: (interval: string) => void;
  onRefresh: () => void;
}

export function DrilldownTimeControls({
  timeRange,
  timeZone,
  refreshInterval,
  onChangeTimeRange,
  onChangeTimeZone,
  onChangeRefreshInterval,
  onRefresh,
}: Props) {
  const setAbsoluteRange = ({ from, to }: AbsoluteTimeRange) => {
    const range = { from: dateTime(from), to: dateTime(to) };
    onChangeTimeRange({ ...range, raw: range });
  };

  return (
    <Stack gap={1} alignItems="center">
      <TimeRangePicker
        isOnCanvas
        value={timeRange}
        timeZone={timeZone}
        onChange={onChangeTimeRange}
        onChangeTimeZone={onChangeTimeZone}
        onMoveBackward={() => setAbsoluteRange(getShiftedTimeRange(-1, timeRange))}
        onMoveForward={() => setAbsoluteRange(getShiftedTimeRange(1, timeRange))}
        onZoom={() => setAbsoluteRange(getZoomedTimeRange(timeRange, 2))}
      />
      <RefreshPicker
        isOnCanvas
        value={refreshInterval}
        onIntervalChanged={onChangeRefreshInterval}
        onRefresh={onRefresh}
      />
      <ToolbarButton
        variant="canvas"
        icon="info-circle"
        tooltip={t('drilldown-page.time-controls.about', 'About Drilldown')}
        aria-label={t('drilldown-page.time-controls.about', 'About Drilldown')}
      />
    </Stack>
  );
}
