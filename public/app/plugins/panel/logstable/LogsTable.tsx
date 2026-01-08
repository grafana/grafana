import { css } from '@emotion/css';
import { useEffect, useState, useMemo } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  DataFrame,
  GrafanaTheme2,
  PanelProps,
  transformDataFrame,
  useDataLinksContext,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { config } from '../../../core/config';
import { getLogsExtractFields } from '../../../features/explore/Logs/LogsTable';
import { FieldNameMetaStore } from '../../../features/explore/Logs/LogsTableWrap';
import { LogsTableFieldSelector } from '../../../features/logs/components/fieldSelector/FieldSelector';
import {
  LOGS_DATAPLANE_BODY_NAME,
  LOGS_DATAPLANE_TIMESTAMP_NAME,
  LogsFrame,
  parseLogsFrame,
} from '../../../features/logs/logsFrame';
import { TablePanel } from '../table/TablePanel';
import type { Options as TableOptions } from '../table/panelcfg.gen';

import type { Options } from './panelcfg.gen';

interface LogsTablePanelProps extends PanelProps<Options> {
  frameIndex?: number;
  showHeader?: boolean;
}

const sidebarWidth = 200;

export const LogsTable = ({
  data,
  width,
  height,
  timeRange,
  fieldConfig,
  options,
  eventBus,
  frameIndex = 0,
  showHeader = true,
  onOptionsChange,
  onFieldConfigChange,
  replaceVariables,
  onChangeTimeRange,
  title,
  transparent,
  timeZone,
  id,
  renderCounter,
}: LogsTablePanelProps) => {
  const dataFrame = data.series[frameIndex];
  const logsFrame: LogsFrame | null = useMemo(() => parseLogsFrame(dataFrame), [dataFrame]);
  const defaultDisplayedFields = useMemo(
    () => [
      logsFrame?.timeField.name ?? LOGS_DATAPLANE_TIMESTAMP_NAME,
      logsFrame?.bodyField.name ?? LOGS_DATAPLANE_BODY_NAME,
    ],
    [logsFrame?.timeField.name, logsFrame?.bodyField.name]
  );

  const [extractedFrame, setExtractedFrame] = useState<DataFrame[] | null>(null);
  const [organizedFrame, setOrganizedFrame] = useState<DataFrame[] | null>(null);
  const [displayedFields, setDisplayedFields] = useState<string[]>(options.displayedFields ?? defaultDisplayedFields);
  const styles = useStyles2(getStyles, sidebarWidth, height, width);
  const dataLinksContext = useDataLinksContext();

  const onTableOptionsChange = (options: TableOptions) => {
    onOptionsChange({});
  };

  const unTransformedDataFrame = data.series[frameIndex];

  /**
   * Extract fields transform
   */
  useEffect(() => {
    const extractFields = async () => {
      return await lastValueFrom(
        transformDataFrame(getLogsExtractFields(unTransformedDataFrame), [unTransformedDataFrame])
      );
    };

    extractFields().then((frame) => {
      setExtractedFrame(
        applyFieldOverrides({
          data: frame,
          fieldConfig: {
            defaults: {},
            overrides: [],
          },
          replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
          theme: config.theme2,
          timeZone: timeZone,
          dataLinkPostProcessor: dataLinksContext.dataLinkPostProcessor,
        })
      );
    });
  }, [dataLinksContext.dataLinkPostProcessor, timeZone, unTransformedDataFrame]);

  /**
   * Organize fields transform
   */
  useEffect(() => {
    const organizeFields = async (displayedFields: string[]) => {
      if (!extractedFrame) {
        return Promise.resolve(null);
      }

      let indexByName: Record<string, number> = {};
      let includeByName: Record<string, boolean> = {};
      if (displayedFields) {
        for (const [idx, field] of displayedFields.entries()) {
          indexByName[field] = idx;
          includeByName[field] = true;
        }
      }

      return await lastValueFrom(
        transformDataFrame(
          [
            {
              id: 'organize',
              options: {
                indexByName,
                includeByName,
              },
            },
          ],
          extractedFrame
        )
      );
    };

    organizeFields(displayedFields).then((frame) => {
      if (frame) {
        setOrganizedFrame(frame);
      }
    });
  }, [extractedFrame, displayedFields]);

  if (extractedFrame === null || organizedFrame === null || logsFrame === null) {
    return;
  }

  console.log('render::LogsTable', { extractedFrame });

  return (
    <div className={styles.wrapper}>
      <div className={styles.sidebarWrapper}>
        <LogsTableFieldSelector
          clear={() => {}}
          columnsWithMeta={displayedFieldsToColumns(displayedFields, logsFrame)}
          dataFrames={extractedFrame}
          logs={[]}
          reorder={(columns: string[]) => {}}
          setSidebarWidth={(width) => {}}
          sidebarWidth={sidebarWidth}
          toggle={(key: string) => {
            if (displayedFields.includes(key)) {
              setDisplayedFields(displayedFields.filter((f) => f !== key));
            } else {
              setDisplayedFields([...displayedFields, key]);
            }
          }}
        />
      </div>
      <div className={styles.tableWrapper}>
        <TablePanel
          data={{ ...data, series: organizedFrame }}
          width={width - sidebarWidth}
          height={height}
          id={id}
          timeRange={timeRange}
          timeZone={timeZone}
          options={{ ...options, frameIndex, showHeader }}
          transparent={transparent}
          fieldConfig={fieldConfig}
          renderCounter={renderCounter}
          title={title}
          eventBus={eventBus}
          onOptionsChange={onTableOptionsChange}
          onFieldConfigChange={onFieldConfigChange}
          replaceVariables={replaceVariables}
          onChangeTimeRange={onChangeTimeRange}
        />
      </div>
    </div>
  );
};

function displayedFieldsToColumns(displayedFields: string[], logsFrame: LogsFrame): FieldNameMetaStore {
  const columns: FieldNameMetaStore = {};
  for (const [idx, field] of displayedFields.entries()) {
    columns[field] = {
      percentOfLinesWithLabel: 0,
      type:
        field === logsFrame.bodyField.name
          ? 'BODY_FIELD'
          : field === logsFrame.timeField.name
            ? 'TIME_FIELD'
            : undefined,
      active: true,
      index: idx,
    };
  }

  return columns;
}

const getStyles = (theme: GrafanaTheme2, sidebarWidth: number, height: number, width: number) => {
  return {
    tableWrapper: css({
      paddingLeft: sidebarWidth,
      height,
      width,
    }),
    sidebarWrapper: css({
      position: 'absolute',
      height: height,
      width: sidebarWidth,
    }),
    wrapper: css({
      height,
      width,
    }),
  };
};
