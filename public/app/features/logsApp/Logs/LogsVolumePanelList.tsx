import { css } from '@emotion/css';
import { flatten, groupBy, mapValues, sortBy } from 'lodash';
import React, { useMemo, useState } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQuery,
  DataQueryResponse,
  DataSourceApi,
  EventBus,
  GrafanaTheme2,
  LoadingState,
  SelectableValue,
  SplitOpen,
  SupplementaryQueryType,
  TimeZone,
} from '@grafana/data';
import { Button, InlineField, Alert, useStyles2, Select } from '@grafana/ui';

import { mergeLogsVolumeDataFrames, isLogsVolumeLimited, getLogsVolumeMaximumRange } from '../../logs/utils';
import { SupplementaryResultError } from '../SupplementaryResultError';

import { LogsVolumePanel } from './LogsVolumePanel';
import { isTimeoutErrorResponse } from './utils/logsVolumeResponse';

type Props = {
  logsVolumeData: DataQueryResponse | undefined;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  width: number;
  onUpdateTimeRange: (timeRange: AbsoluteTimeRange) => void;
  onLoadLogsVolume: (suppQueryType?: SupplementaryQueryType) => void;
  onHiddenSeriesChanged: (hiddenSeries: string[]) => void;
  eventBus: EventBus;
  onClose?(): void;
  datasourceInstance: DataSourceApi<DataQuery>;
};

export const LogsVolumePanelList = ({
  logsVolumeData,
  absoluteRange,
  onUpdateTimeRange,
  width,
  onLoadLogsVolume,
  onHiddenSeriesChanged,
  eventBus,
  splitOpen,
  timeZone,
  onClose,
  datasourceInstance,
}: Props) => {
  const {
    logVolumes,
    maximumValue: allLogsVolumeMaximumValue,
    maximumRange: allLogsVolumeMaximumRange,
  } = useMemo(() => {
    let maximumValue = -Infinity;
    const sorted = sortBy(logsVolumeData?.data || [], 'meta.custom.datasourceName');
    const grouped = groupBy(sorted, 'meta.custom.datasourceName');
    const logVolumes = mapValues(grouped, (value) => {
      const mergedData = mergeLogsVolumeDataFrames(value);
      maximumValue = Math.max(maximumValue, mergedData.maximum);
      return mergedData.dataFrames;
    });
    const maximumRange = getLogsVolumeMaximumRange(flatten(Object.values(logVolumes)));
    return {
      maximumValue,
      maximumRange,
      logVolumes,
    };
  }, [logsVolumeData]);

  const [state, setState] = useState<{
    labelNames?: SelectableValue[];
    isLoadingLabelNames?: boolean;
  }>({});
  const [labelNamesMenuOpen, setLabelNamesMenuOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<SelectableValue<string>>({ label: 'none', value: 'none' });

  const styles = useStyles2(getStyles);

  const numberOfLogVolumes = Object.keys(logVolumes).length;

  const containsZoomed = Object.values(logVolumes).some((data: DataFrame[]) => {
    const zoomRatio = logsLevelZoomRatio(data, absoluteRange);
    return !isLogsVolumeLimited(data) && zoomRatio && zoomRatio < 1;
  });

  const timeoutError = isTimeoutErrorResponse(logsVolumeData);

  const visibleRange = {
    from: Math.max(absoluteRange.from, allLogsVolumeMaximumRange.from),
    to: Math.min(absoluteRange.to, allLogsVolumeMaximumRange.to),
  };

  if (logsVolumeData?.state === LoadingState.Loading) {
    return <span>Loading...</span>;
  } else if (timeoutError) {
    return (
      <SupplementaryResultError
        title="The logs volume query has timed out"
        // Using info to avoid users thinking that the actual query has failed.
        severity="info"
        suggestedAction="Retry"
        onSuggestedAction={onLoadLogsVolume}
        onRemove={onClose}
      />
    );
  } else if (logsVolumeData?.error !== undefined) {
    return <SupplementaryResultError error={logsVolumeData.error} title="Failed to load log volume for this query" />;
  }

  if (numberOfLogVolumes === 0) {
    return (
      <div className={styles.alertContainer}>
        <Alert severity="info" title="No logs volume available">
          No volume information available for the current queries and time range.
        </Alert>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {Object.keys(logVolumes).map((name, index) => {
        const logsVolumeData = { data: logVolumes[name] };
        return (
          <LogsVolumePanel
            key={index}
            absoluteRange={visibleRange}
            allLogsVolumeMaximum={allLogsVolumeMaximumValue}
            width={width}
            logsVolumeData={logsVolumeData}
            onUpdateTimeRange={onUpdateTimeRange}
            timeZone={timeZone}
            splitOpen={splitOpen}
            onLoadLogsVolume={onLoadLogsVolume}
            // TODO: Support filtering level from multiple log levels
            onHiddenSeriesChanged={numberOfLogVolumes > 1 ? () => {} : onHiddenSeriesChanged}
            eventBus={eventBus}
          />
        );
      })}
      <div className={styles.extraInfoContainer}>
        {containsZoomed && (
          <InlineField label="Reload log volume" transparent>
            <Button size="xs" icon="sync" variant="secondary" onClick={() => onLoadLogsVolume()} id="reload-volume" />
          </InlineField>
        )}
        <div style={{ display: 'flex' }}>
          <InlineField label="Group by">
            <Select
              onOpenMenu={async () => {
                setState({ isLoadingLabelNames: true });
                // @ts-ignore this should be implemented for test data sources
                const labels = await datasourceInstance.getTagKeys();
                const labelNames = labels.map((l) => ({ label: l.text, value: l.text }));
                setLabelNamesMenuOpen(true);
                setState({
                  labelNames: [{ label: 'none', value: 'none' }, ...labelNames],
                  isLoadingLabelNames: undefined,
                });
              }}
              isOpen={labelNamesMenuOpen}
              isLoading={state.isLoadingLabelNames}
              options={state.labelNames}
              width={20}
              value={selectedLabel}
              onChange={(change) => {
                setSelectedLabel(change);
                setLabelNamesMenuOpen(false);
                if (change.value !== selectedLabel.value) {
                  onLoadLogsVolume(SupplementaryQueryType.LogsVolume);
                }
              }}
            />
          </InlineField>
          <InlineField>
            <>
              <Button icon="chart-line" size="xs" variant="secondary" style={{ marginLeft: '4px' }} />
              <Button icon="graph-bar" size="xs" variant="secondary" style={{ marginLeft: '4px' }} />
              <Button icon="calculator-alt" size="xs" variant="secondary" style={{ marginLeft: '4px' }} />
            </>
          </InlineField>
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    listContainer: css`
      padding-top: 10px;
    `,
    extraInfoContainer: css`
      display: flex;
      justify-content: end;
      position: absolute;
      right: 5px;
      top: 5px;
    `,
    oldInfoText: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
    alertContainer: css`
      width: 50%;
      min-width: ${theme.breakpoints.values.sm}px;
      margin: 0 auto;
    `,
  };
};

function logsLevelZoomRatio(
  logsVolumeData: DataFrame[] | undefined,
  selectedTimeRange: AbsoluteTimeRange
): number | undefined {
  const dataRange = logsVolumeData && logsVolumeData[0] && logsVolumeData[0].meta?.custom?.absoluteRange;
  return dataRange ? (selectedTimeRange.from - selectedTimeRange.to) / (dataRange.from - dataRange.to) : undefined;
}
