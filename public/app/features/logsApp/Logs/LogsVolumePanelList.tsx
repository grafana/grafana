import { css } from '@emotion/css';
import { flatten, groupBy, mapValues, sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataQuery,
  DataQueryResponse,
  DataSourceApi,
  EventBus,
  GrafanaTheme2,
  LoadingState,
  PanelData,
  SelectableValue,
  SplitOpen,
  SupplementaryQueryType,
  TimeZone,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { FieldColorModeId } from '@grafana/schema';
import { Button, InlineField, useStyles2, Select } from '@grafana/ui';

import { mergeLogsVolumeDataFrames, isLogsVolumeLimited, getLogsVolumeMaximumRange } from '../../logs/utils';

import { LogsVolumePanel } from './LogsVolumePanel';

type Props = {
  logsVolumeData: DataQueryResponse | undefined;
  logsCountData: DataQueryResponse | undefined;
  logsCountWithGroupByData: DataQueryResponse | undefined;
  logsVolumeWithGroupByData: DataQueryResponse | undefined;
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
  logsCountData,
  logsCountWithGroupByData,
  logsVolumeWithGroupByData,
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
    const sorted = sortBy(logsVolumeData?.data ?? logsVolumeWithGroupByData?.data ?? [], 'meta.custom.datasourceName');
    console.log('sorted', sorted);
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
  }, [logsVolumeData, logsVolumeWithGroupByData]);

  const [state, setState] = useState<{
    labelNames?: SelectableValue[];
    isLoadingLabelNames?: boolean;
  }>({});
  const [labelNamesMenuOpen, setLabelNamesMenuOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<SelectableValue<string | undefined>>({
    label: 'none',
    value: 'none',
  });
  const [selectedQueryType, setSelectedQueryType] = useState<SupplementaryQueryType | undefined>(
    SupplementaryQueryType.LogsVolume
  );

  useEffect(() => {
    if (selectedQueryType) {
      if (selectedLabel && selectedLabel.value !== 'none') {
        if (selectedQueryType === SupplementaryQueryType.LogsVolume) {
          onLoadLogsVolume(SupplementaryQueryType.LogsVolumeWithGroupBy);
        }
        if (selectedQueryType === SupplementaryQueryType.LogsCount) {
          onLoadLogsVolume(SupplementaryQueryType.LogsCountWithGroupBy);
        }
      } else {
        onLoadLogsVolume(selectedQueryType);
      }
    }
  }, [selectedLabel, selectedQueryType]);

  const styles = useStyles2(getStyles);

  const numberOfLogVolumes = Object.keys(logVolumes).length;

  const containsZoomed = Object.values(logVolumes).some((data: DataFrame[]) => {
    const zoomRatio = logsLevelZoomRatio(data, absoluteRange);
    return !isLogsVolumeLimited(data) && zoomRatio && zoomRatio < 1;
  });

  const visibleRange = {
    from: Math.max(absoluteRange.from, allLogsVolumeMaximumRange.from),
    to: Math.min(absoluteRange.to, allLogsVolumeMaximumRange.to),
  };

  if (
    logsVolumeData?.state === LoadingState.Loading ||
    logsCountData?.state === LoadingState.Loading ||
    logsCountWithGroupByData?.state === LoadingState.Loading
  ) {
    return <span>Loading...</span>;
  }

  return (
    <div className={styles.listContainer}>
      {logsCountData?.data && logsCountData?.state === LoadingState.Done && (
        <PanelRenderer
          title="Logs count"
          width={width}
          pluginId="stat"
          height={120}
          data={{ series: logsCountData?.data, state: logsCountData?.state } as PanelData}
          fieldConfig={{
            defaults: {
              color: {
                mode: FieldColorModeId.PaletteClassic,
              },
              custom: {},
            },
            overrides: [],
          }}
        />
      )}
      {logsCountWithGroupByData?.data && logsCountWithGroupByData?.state === LoadingState.Done && (
        <PanelRenderer
          title="Logs count"
          width={width}
          pluginId="stat"
          height={120}
          options={{
            reduceOptions: {
              values: 'true',
              calcs: ['lastNotNull'],
            },
            orientation: 'auto',
            textMode: 'auto',
            wideLayout: true,
            colorMode: 'background',
            graphMode: 'area',
            justifyMode: 'auto',
          }}
          data={{ series: logsCountWithGroupByData?.data, state: logsCountWithGroupByData?.state } as PanelData}
          fieldConfig={{
            defaults: {
              color: {
                mode: FieldColorModeId.PaletteClassic,
              },
              // unit: 'log lines',
              custom: {},
            },
            overrides: [],
          }}
        />
      )}
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
            isWithGroupBy={selectedLabel && selectedLabel.value !== 'none'}
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
                setLabelNamesMenuOpen(false);
                if (change.value !== selectedLabel.value) {
                  if (change.value === 'none') {
                    setSelectedLabel(undefined);
                    datasourceInstance.groupByFilter = undefined;
                  } else {
                    setSelectedLabel(change);
                    datasourceInstance.groupByFilter = change.value;
                  }
                }
              }}
            />
          </InlineField>
          <InlineField>
            <>
              <Button
                icon="chart-line"
                size="xs"
                variant="secondary"
                style={{ marginLeft: '4px' }}
                onClick={() => setSelectedQueryType(SupplementaryQueryType.LogsVolume)}
              />
              <Button
                icon="graph-bar"
                size="xs"
                variant="secondary"
                style={{ marginLeft: '4px' }}
                onClick={() => setSelectedQueryType(SupplementaryQueryType.LogsCount)}
              />
              {/* <Button
                icon="calculator-alt"
                size="xs"
                variant="secondary"
                style={{ marginLeft: '4px' }}
                onClick={() => setSelectedQueryType(SupplementaryQueryType.LogsCount)}
              /> */}
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
      top: -25px;
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
