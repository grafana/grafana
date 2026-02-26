import { useCallback, useMemo } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  EventBus,
  EventBusSrv,
  ExploreLogsPanelState,
  FieldConfig,
  PanelData,
  urlUtil,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { AdHocFilterItem, PanelContextProvider } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { LogsTable } from 'app/plugins/panel/logstable/LogsTable';
import { Options } from 'app/plugins/panel/logstable/options/types';
import { defaultOptions as logsTablePanelDefaultOptions } from 'app/plugins/panel/logstable/panelcfg.gen';
import { BuildLinkToLogLine } from 'app/plugins/panel/logstable/types';

import { exploreLogsTableFieldConfigDefaults } from './constants';

/**
 * New Logs Table panel
 * @param props
 * @constructor
 */
export function ExploreLogsTable(props: {
  tableFieldConfig: FieldConfig<Options> | undefined;
  updatePanelState: (panelState: ExploreLogsPanelState) => void;
  eventBus: EventBus;
  data: PanelData;
  timeZone: 'utc' | 'browser' | string;
  buildLinkToLogLine: BuildLinkToLogLine;
  width: number;
  height: number;
  onOptionsChange: (options: Options) => void;
  onChangeTimeRange: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel: ((key: string, value: string, frame?: DataFrame) => void) | undefined;
  onClickFilterOutLabel: ((key: string, value: string, frame?: DataFrame) => void) | undefined;
  externalOptions: Pick<
    Options,
    'sortBy' | 'sortOrder' | 'displayedFields' | 'permalinkedLogId' | 'frameIndex' | 'fieldSelectorWidth'
  >;
}) {
  const { onClickFilterLabel, onClickFilterOutLabel, tableFieldConfig, updatePanelState } = props;
  const frames = useMemo(() => props?.data.series ?? [], [props.data.series]);
  const frame = useMemo(() => frames[props.externalOptions.frameIndex], [frames, props.externalOptions.frameIndex]);

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

  const selectedLogInfo = useMemo(() => {
    const { selectedLine } = urlUtil.getUrlSearchParams();

    const param = Array.isArray(selectedLine) ? selectedLine[0] : selectedLine;

    if (typeof param !== 'string') {
      return undefined;
    }

    try {
      const { id, row } = JSON.parse(param);
      return { id, row };
    } catch (error) {
      return undefined;
    }
  }, []);

  console.log('fieldCOnfig', tableFieldConfig);

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
        timeZone={props.timeZone}
        options={{
          ...logsTablePanelDefaultOptions,
          buildLinkToLogLine: props.buildLinkToLogLine,
          showHeader: true,
          showControls: true,
          showCopyLogLink: true,
          ...props.externalOptions,
          permalinkedLogId: props.externalOptions.permalinkedLogId ?? selectedLogInfo?.id,
        }}
        transparent={false}
        width={props.width}
        height={props.height}
        fieldConfig={{
          defaults: tableFieldConfig ?? exploreLogsTableFieldConfigDefaults,
          overrides: [],
        }}
        renderCounter={0}
        title={''}
        eventBus={props.eventBus}
        onOptionsChange={props.onOptionsChange}
        onFieldConfigChange={(config) => {
          console.log('onFieldConfigChange', config);
          updatePanelState({ tableFieldConfig: config.defaults });
        }}
        replaceVariables={getTemplateSrv().replace}
        onChangeTimeRange={props.onChangeTimeRange}
      />
    </PanelContextProvider>
  );
}
