import { useCallback, useMemo, useState } from 'react';

import { type AbsoluteTimeRange, CoreApp, type EventBus, type FieldConfigSource, type PanelData, store, urlUtil } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { getTemplateSrv } from '@grafana/runtime';
import { type AdHocFilterItem, PanelContextProvider } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { LogsTable } from 'app/plugins/panel/logstable/LogsTable';
import { getDefaultLogDetailsWidth } from 'app/plugins/panel/logstable/LogsTableDetails';
import { type Options } from 'app/plugins/panel/logstable/options/types';
import { defaultOptions as logsTablePanelDefaultOptions } from 'app/plugins/panel/logstable/panelcfg.gen';
import { type BuildLinkToLogLine } from 'app/plugins/panel/logstable/types';

import { SETTING_KEY_ROOT } from './utils/logs';

interface Props {
  eventBus: EventBus;
  data: PanelData;
  isLabelFilterActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  timeZone: 'utc' | 'browser' | string;
  buildLinkToLogLine: BuildLinkToLogLine;
  width: number;
  height: number;
  onOptionsChange: (options: Options) => void;
  onFieldConfigChange?: (config: FieldConfigSource) => void;
  onChangeTimeRange: (range: AbsoluteTimeRange) => void;
  onClickFilterLabel: ((key: string, value: string, frame?: DataFrame) => void) | undefined;
  onClickFilterOutLabel: ((key: string, value: string, frame?: DataFrame) => void) | undefined;
  externalOptions: Pick<
    Options,
    'sortBy' | 'sortOrder' | 'displayedFields' | 'permalinkedLogId' | 'frameIndex' | 'fieldSelectorWidth'
  >;
}

/**
 * New Logs Table panel
 */
export function ExploreLogsTable(props: Props) {
  const { onClickFilterLabel, onClickFilterOutLabel } = props;
  const frames = useMemo(() => props?.data.series ?? [], [props.data.series]);
  const frame = useMemo(() => frames[props.externalOptions.frameIndex], [frames, props.externalOptions.frameIndex]);
  const [wrapText, setWrapText] = useState(store.getBool(`${SETTING_KEY_ROOT}.wrapText`, false));
  const [columnWidths, setColumnWidths] = useState<ColumnWidth[]>(getColumnWidthsFromStorage());

  const handleAdHocFilter = useCallback(
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

  const onOptionsChange = useCallback(
    (options: Options) => {
      if (options.wrapText !== undefined && options.wrapText !== wrapText) {
        setWrapText(options.wrapText);
        store.set(`${SETTING_KEY_ROOT}.wrapText`, options.wrapText);
      } else if (options.logDetailsWidth !== undefined && options.logDetailsWidth > 0) {
        store.set(`${SETTING_KEY_ROOT}.logDetailsWidth`, options.logDetailsWidth);
      }
      props.onOptionsChange(options);
    },
    [props, wrapText]
  );

  const options = useMemo(
    () => ({
      ...logsTablePanelDefaultOptions,
      buildLinkToLogLine: props.buildLinkToLogLine,
      showHeader: true,
      showControls: true,
      showCopyLogLink: true,
      ...props.externalOptions,
      isLabelFilterActive: props.isLabelFilterActive,
      permalinkedLogId: props.externalOptions.permalinkedLogId ?? selectedLogInfo?.id,
      logDetailsWidth: parseInt(store.get(`${SETTING_KEY_ROOT}.logDetailsWidth`) ?? getDefaultLogDetailsWidth(), 10),
      wrapText,
    }),
    [props.buildLinkToLogLine, props.externalOptions, props.isLabelFilterActive, selectedLogInfo?.id, wrapText]
  );

  const handleFieldConfigChange = useCallback((config: FieldConfigSource) => {
    const widthOverrides = config.overrides
      .filter((override) => override.matcher.id === 'byName')
      .filter((override) =>
        override.properties.some((property) => property.id === 'custom.width' && property.value > 0)
      )
      .map((override) => {
        const field = override.matcher.options;
        const width = override.properties.find(
          (property) => property.id === 'custom.width' && property.value > 0
        )?.value;
        return {
          field,
          width,
        };
      });
    store.set(`${SETTING_KEY_ROOT}.explore.columnWidths`, JSON.stringify(widthOverrides));
    setColumnWidths(getColumnWidthsFromStorage());
  }, []);

  const fieldConfig = useMemo(
    () => ({
      defaults: {
        custom: {
          filterable: true,
        },
      },
      overrides: columnWidths.map((columnWidth) => ({
        matcher: {
          id: 'byName',
          options: columnWidth.field,
        },
        properties: [
          {
            id: 'custom.width',
            value: columnWidth.width,
          },
        ],
      })),
    }),
    [columnWidths]
  );

  return (
    <PanelContextProvider
      value={{
        eventsScope: 'explore',
        eventBus: props.eventBus,
        onAddAdHocFilter: handleAdHocFilter,
        app: CoreApp.Explore,
      }}
    >
      <LogsTable
        data={props.data}
        id={0}
        timeZone={props.timeZone}
        options={options}
        transparent={false}
        width={props.width}
        height={props.height}
        fieldConfig={fieldConfig}
        renderCounter={0}
        title={''}
        eventBus={props.eventBus}
        onOptionsChange={onOptionsChange}
        onFieldConfigChange={handleFieldConfigChange}
        replaceVariables={getTemplateSrv().replace}
        onChangeTimeRange={props.onChangeTimeRange}
      />
    </PanelContextProvider>
  );
}

type ColumnWidth = { field: string; width: number };

function getColumnWidthsFromStorage() {
  const stored = store.getObject(`${SETTING_KEY_ROOT}.explore.columnWidths`);

  let columnWidths = Array.isArray(stored)
    ? stored.filter(
        (columnWidth: unknown): columnWidth is ColumnWidth =>
          typeof columnWidth === 'object' &&
          columnWidth !== null &&
          'field' in columnWidth &&
          'width' in columnWidth &&
          typeof columnWidth.width === 'number' &&
          typeof columnWidth.field === 'string'
      )
    : [];

  return columnWidths;
}
