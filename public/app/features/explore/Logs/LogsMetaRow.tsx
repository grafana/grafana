import { css } from '@emotion/css';
import saveAs from 'file-saver';
import React from 'react';

import { LogsDedupStrategy, LogsMetaItem, LogsMetaKind, LogRowModel, CoreApp, dateTimeFormat } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Menu, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';

import { downloadLogsModelAsTxt } from '../../inspector/utils/download';
import { LogLabels } from '../../logs/components/LogLabels';
import { MAX_CHARACTERS } from '../../logs/components/LogRowMessage';
import { logRowsToReadableJson } from '../../logs/utils';
import { MetaInfoText, MetaItemProps } from '../MetaInfoText';

const getStyles = () => ({
  metaContainer: css`
    flex: 1;
    display: flex;
    flex-wrap: wrap;
  `,
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
}

export const LogsMetaRow = React.memo(
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

    const downloadLogs = (format: DownloadFormat) => {
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
          value: renderMetaItem(displayedFields, LogsMetaKind.LabelsMap),
        },
        {
          label: '',
          value: (
            <Button variant="secondary" size="sm" onClick={clearDetectedFields}>
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
            <Dropdown overlay={downloadMenu}>
              <ToolbarButton isOpen={false} variant="canvas" icon="download-alt">
                Download
              </ToolbarButton>
            </Dropdown>
          </div>
        )}
      </>
    );
  }
);

LogsMetaRow.displayName = 'LogsMetaRow';

function renderMetaItem(value: any, kind: LogsMetaKind) {
  if (kind === LogsMetaKind.LabelsMap) {
    return <LogLabels labels={value} />;
  } else if (kind === LogsMetaKind.Error) {
    return <span className="logs-meta-item__error">{value}</span>;
  }
  return value;
}
