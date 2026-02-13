import { useCallback, useMemo } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  EventBus,
  EventBusSrv,
  ExplorePanelsState,
  FieldConfigSource,
  LogsSortOrder,
  PanelData,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { AdHocFilterItem, PanelContextProvider } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { LogsTable } from 'app/plugins/panel/logstable/LogsTable';
import { Options } from 'app/plugins/panel/logstable/options/types';
import { defaultOptions as logsTablePanelDefaultOptions } from 'app/plugins/panel/logstable/panelcfg.gen';
import { BuildLinkToLogLine } from 'app/plugins/panel/logstable/types';

/**
 * New Logs Table panel
 * @param props
 * @constructor
 */
export function ExploreLogsTable(props: {
  tableFrameIndex: number;
  eventBus: EventBus;
  data: PanelData;
  timeRange: TimeRange;
  timeZone: 'utc' | 'browser' | string;
  buildLinkToLogLine: BuildLinkToLogLine;
  displayedFields: string[];
  panelState: ExplorePanelsState | undefined;
  sortOrder: LogsSortOrder;
  width: number;
  height: number;
  onOptionsChange: (options: Options) => void;
  onFieldConfigChange: (config: FieldConfigSource) => void;
  onChangeTimeRange: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
}) {
  const { onClickFilterLabel, onClickFilterOutLabel, tableFrameIndex } = props;
  const frames = useMemo(() => props?.data.series ?? [], [props.data.series]);
  const frame = useMemo(() => frames[tableFrameIndex], [frames, tableFrameIndex]);

  const onCellFilterAdded = useCallback(
    (filter: AdHocFilterItem) => {
      const { value, key, operator } = filter;

      if (!onClickFilterLabel || !onClickFilterOutLabel) {
        return;
      }

      if (operator === FILTER_FOR_OPERATOR) {
        onClickFilterLabel(key, value, frame);
      }

      if (operator === FILTER_OUT_OPERATOR) {
        onClickFilterOutLabel(key, value, frame);
      }
    },
    [onClickFilterLabel, onClickFilterOutLabel, frame]
  );

  return (
    <PanelContextProvider
      value={{
        eventsScope: 'explore',
        eventBus: props.eventBus ?? new EventBusSrv(),
        onAddAdHocFilter: onCellFilterAdded,
      }}
    >
      <LogsTable
        data={props.data}
        id={0}
        timeRange={props.timeRange}
        timeZone={props.timeZone}
        options={{
          ...logsTablePanelDefaultOptions,
          showHeader: true,
          showControls: true,
          showCopyLogLink: true,
          frameIndex: tableFrameIndex,
          buildLinkToLogLine: props.buildLinkToLogLine,
          displayedFields: props.displayedFields,
          permalinkedLogId: props.panelState?.logs?.id,
          sortOrder: props.sortOrder,
        }}
        transparent={false}
        width={props.width}
        height={props.height}
        fieldConfig={{
          defaults: {},
          overrides: [],
        }}
        renderCounter={0}
        title={''}
        eventBus={props.eventBus}
        onOptionsChange={props.onOptionsChange}
        onFieldConfigChange={props.onFieldConfigChange}
        replaceVariables={getTemplateSrv().replace}
        onChangeTimeRange={props.onChangeTimeRange}
      />
    </PanelContextProvider>
  );
}
