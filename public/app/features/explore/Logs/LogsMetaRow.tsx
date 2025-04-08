import { css } from '@emotion/css';
import { memo } from 'react';

import { LogsDedupStrategy, LogsMetaItem, LogsMetaKind, LogRowModel, CoreApp, Labels } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Menu, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { LogLabels, LogLabelsList } from '../../logs/components/LogLabels';
import { MAX_CHARACTERS } from '../../logs/components/LogRowMessage';
import { DownloadFormat, downloadLogs } from '../../logs/utils';
import { MetaInfoText, MetaItemProps } from '../MetaInfoText';

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
              <Trans i18nKey="explore.logs-meta-row.show-original-line">Show original line</Trans>
            </Button>
          ),
        }
      );
    }

    function download(format: DownloadFormat) {
      reportInteraction('grafana_logs_download_logs_clicked', {
        app: CoreApp.Explore,
        format,
        area: 'logs-meta-row',
      });
      downloadLogs(format, logRows, meta);
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
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <Menu.Item label="txt" onClick={() => download(DownloadFormat.Text)} />
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <Menu.Item label="json" onClick={() => download(DownloadFormat.Json)} />
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <Menu.Item label="csv" onClick={() => download(DownloadFormat.CSV)} />
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
            {!config.featureToggles.logsPanelControls && !config.exploreHideLogsDownload && (
              <Dropdown overlay={downloadMenu}>
                <ToolbarButton isOpen={false} variant="canvas" icon="download-alt">
                  <Trans i18nKey="explore.logs-meta-row.download">Download</Trans>
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
