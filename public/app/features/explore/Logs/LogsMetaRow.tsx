import { css } from '@emotion/css';
import saveAs from 'file-saver';
import { memo } from 'react';
import { lastValueFrom } from 'rxjs';

import {
  LogsDedupStrategy,
  LogsMetaItem,
  LogsMetaKind,
  LogRowModel,
  CoreApp,
  dateTimeFormat,
  transformDataFrame,
  DataTransformerConfig,
  CustomTransformOperator,
  Labels,
} from '@grafana/data';
import { DataFrame } from '@grafana/data/';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Menu, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';

import { downloadDataFrameAsCsv, downloadLogsModelAsTxt } from '../../inspector/utils/download';
import { LogLabels, LogLabelsList } from '../../logs/components/LogLabels';
import { MAX_CHARACTERS } from '../../logs/components/LogRowMessage';
import { logRowsToReadableJson } from '../../logs/utils';
import { MetaInfoText, MetaItemProps } from '../MetaInfoText';

import { getLogsExtractFields } from './LogsTable';

const getStyles = () => ({
  metaContainer: css({
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
  }),
});

export type Props = {
  meta: LogsMetaItem[];
  dedupStrategy: LogsDedupStrategy;
  dedupCount: number;
  displayedFields: string[];
  hasUnescapedContent: boolean;
  forceEscape: boolean;
  logRows: LogRowModel[];
  onEscapeNewlines: () => void;
  clearDetectedFields: () => void;
};

enum DownloadFormat {
  Text = 'text',
  Json = 'json',
  CSV = 'csv',
}

export const LogsMetaRow = memo(
  ({
    meta,
    dedupStrategy,
    dedupCount,
    displayedFields,
    clearDetectedFields,
    hasUnescapedContent,
    forceEscape,
    onEscapeNewlines,
    logRows,
  }: Props) => {
    const style = useStyles2(getStyles);

    const downloadLogs = async (format: DownloadFormat) => {
      reportInteraction('grafana_logs_download_logs_clicked', {
        app: CoreApp.Explore,
        format,
        area: 'logs-meta-row',
      });

      switch (format) {
        case DownloadFormat.Text:
          downloadLogsModelAsTxt({ meta, rows: logRows }, 'Explore');
          break;
        case DownloadFormat.Json:
          const jsonLogs = logRowsToReadableJson(logRows);
          const blob = new Blob([JSON.stringify(jsonLogs)], {
            type: 'application/json;charset=utf-8',
          });
          const fileName = `Explore-logs-${dateTimeFormat(new Date())}.json`;
          saveAs(blob, fileName);
          break;
        case DownloadFormat.CSV:
          const dataFrameMap = new Map<string, DataFrame>();
          logRows.forEach((row) => {
            if (row.dataFrame?.refId && !dataFrameMap.has(row.dataFrame?.refId)) {
              dataFrameMap.set(row.dataFrame?.refId, row.dataFrame);
            }
          });
          dataFrameMap.forEach(async (dataFrame) => {
            const transforms: Array<DataTransformerConfig | CustomTransformOperator> = getLogsExtractFields(dataFrame);
            transforms.push({
              id: 'organize',
              options: {
                excludeByName: {
                  ['labels']: true,
                  ['labelTypes']: true,
                },
              },
            });
            const transformedDataFrame = await lastValueFrom(transformDataFrame(transforms, [dataFrame]));
            downloadDataFrameAsCsv(transformedDataFrame[0], `Explore-logs-${dataFrame.refId}`);
          });
      }
    };

    const logsMetaItem: Array<LogsMetaItem | MetaItemProps> = [...meta];

    // Add deduplication info
    if (dedupStrategy !== LogsDedupStrategy.none) {
      logsMetaItem.push({
        label: 'Deduplication count',
        value: dedupCount,
        kind: LogsMetaKind.Number,
      });
    }
    // Add info about limit for highlighting
    if (logRows.some((r) => r.entry.length > MAX_CHARACTERS)) {
      logsMetaItem.push({
        label: 'Info',
        value: 'Logs with more than 100,000 characters could not be parsed and highlighted',
        kind: LogsMetaKind.String,
      });
    }

    // Add detected fields info
    if (displayedFields?.length > 0) {
      logsMetaItem.push(
        {
          label: 'Showing only selected fields',
          value: <LogLabelsList labels={displayedFields} />,
        },
        {
          label: '',
          value: (
            <Button variant="primary" fill="outline" size="sm" onClick={clearDetectedFields}>
              Show original line
            </Button>
          ),
        }
      );
    }

    // Add unescaped content info
    if (hasUnescapedContent) {
      logsMetaItem.push({
        label: 'Your logs might have incorrectly escaped content',
        value: (
          <Tooltip
            content="Fix incorrectly escaped newline and tab sequences in log lines. Manually review the results to confirm that the replacements are correct."
            placement="right"
          >
            <Button variant="secondary" size="sm" onClick={onEscapeNewlines}>
              {forceEscape ? 'Remove escaping' : 'Escape newlines'}
            </Button>
          </Tooltip>
        ),
      });
    }
    const downloadMenu = (
      <Menu>
        <Menu.Item label="txt" onClick={() => downloadLogs(DownloadFormat.Text)} />
        <Menu.Item label="json" onClick={() => downloadLogs(DownloadFormat.Json)} />
        <Menu.Item label="csv" onClick={() => downloadLogs(DownloadFormat.CSV)} />
      </Menu>
    );
    return (
      <>
        {logsMetaItem && (
          <div className={style.metaContainer}>
            <MetaInfoText
              metaItems={logsMetaItem.map((item) => {
                return {
                  label: item.label,
                  value: 'kind' in item ? renderMetaItem(item.value, item.kind) : item.value,
                };
              })}
            />
            {!config.exploreHideLogsDownload && (
              <Dropdown overlay={downloadMenu}>
                <ToolbarButton isOpen={false} variant="canvas" icon="download-alt">
                  Download
                </ToolbarButton>
              </Dropdown>
            )}
          </div>
        )}
      </>
    );
  }
);

LogsMetaRow.displayName = 'LogsMetaRow';

function renderMetaItem(value: string | number | Labels, kind: LogsMetaKind) {
  if (typeof value === 'string' || typeof value === 'number') {
    return <>{value}</>;
  }
  if (kind === LogsMetaKind.LabelsMap) {
    return <LogLabels labels={value} />;
  }
  if (kind === LogsMetaKind.Error) {
    return <span className="logs-meta-item__error">{value.toString()}</span>;
  }
  console.error(`Meta type ${typeof value} ${value} not recognized.`);
  return <></>;
}
