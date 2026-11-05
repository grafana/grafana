import { css, cx } from '@emotion/css';
import { useCallback, useMemo, type MouseEvent } from 'react';

import { type GrafanaTheme2, LogLevel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, type CustomCellRendererProps, Icon, IconButton, Tooltip, useTheme2 } from '@grafana/ui';
import { classifyErrorAttributes } from 'app/features/logs/components/otel/details';
import { getIconButtonStyles } from 'app/features/logs/components/panel/activeIconButtonStyles';
import { type LogFrameLabels, type LogsFrame } from 'app/features/logs/logsFrame';
import { LogLevelColor } from 'app/features/logs/logsModel';

import { useLogDetailsContext } from '../LogDetailsContext';
import { type BuildLinkToLogLine } from '../types';

export const ERROR_ATTRIBUTE_ICON_WIDTH = 24;

interface Props extends CustomCellRendererProps {
  buildLinkToLog?: BuildLinkToLogLine;
  logsFrame: LogsFrame;
}

type ErrorAttributeKind = 'stacktrace' | 'error';

export function logsFrameHasErrorAttributes(logsFrame: LogsFrame): boolean {
  const cached = logsFrameHasErrorAttributesCache.get(logsFrame);
  if (cached !== undefined) {
    return cached;
  }

  const rowCount = logsFrame.bodyField.values.length;
  const labelsPerRow = getLogsFrameLabels(logsFrame);
  let hasErrorAttributes = false;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    if (getRowErrorAttributeKind(logsFrame, rowIndex, labelsPerRow)) {
      hasErrorAttributes = true;
      break;
    }
  }
  logsFrameHasErrorAttributesCache.set(logsFrame, hasErrorAttributes);
  return hasErrorAttributes;
}

const logsFrameHasErrorAttributesCache = new WeakMap<LogsFrame, boolean>();

// getLogFrameLabelsAsLabels remaps every row. Callers only need keys, so read labels once per frame.
const logsFrameLabelsCache = new WeakMap<LogsFrame, LogFrameLabels[] | null>();

function getLogsFrameLabels(logsFrame: LogsFrame): LogFrameLabels[] | null {
  if (logsFrameLabelsCache.has(logsFrame)) {
    return logsFrameLabelsCache.get(logsFrame) ?? null;
  }

  const labels = logsFrame.getLogFrameLabels();
  logsFrameLabelsCache.set(logsFrame, labels);
  return labels;
}

function getRowErrorAttributeKind(
  logsFrame: LogsFrame,
  rowIndex: number,
  labelsPerRow: LogFrameLabels[] | null = getLogsFrameLabels(logsFrame)
): ErrorAttributeKind | undefined {
  const labels = labelsPerRow?.[rowIndex];
  const labelKeys = labels ? Object.keys(labels) : [];
  const fieldKeys = logsFrame.extraFields
    .filter((field) => {
      const value = field.values[rowIndex];
      return value != null && value !== '';
    })
    .map((field) => field.name);
  const classifiedLabels = classifyErrorAttributes(labelKeys, (key) => key);
  const classifiedFields = classifyErrorAttributes(fieldKeys, (key) => key);

  if (classifiedLabels.stacktraces.length > 0 || classifiedFields.stacktraces.length > 0) {
    return 'stacktrace';
  }
  if (
    classifiedLabels.messages.length > 0 ||
    classifiedFields.messages.length > 0 ||
    classifiedLabels.other.length > 0 ||
    classifiedFields.other.length > 0
  ) {
    return 'error';
  }
  return undefined;
}

/**
 * Logs row actions buttons
 * @param props
 * @constructor
 */
export function LogsTableRowActionButtons(props: Props) {
  const { rowIndex, buildLinkToLog, logsFrame } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { enableLogDetails, detailsDisplayed, toggleDetails } = useLogDetailsContext();
  const errorAttributeKind = getRowErrorAttributeKind(logsFrame, rowIndex);
  const reserveErrorAttributeSpace = logsFrameHasErrorAttributes(logsFrame);

  const handleDetailsClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      const modifierKeyPressed = e.ctrlKey || e.metaKey || e.shiftKey;
      toggleDetails(rowIndex, modifierKeyPressed);
    },
    [rowIndex, toggleDetails]
  );

  return (
    <>
      <div className={styles.container}>
        {enableLogDetails && (
          <div className={styles.buttonWrapper}>
            <IconButton
              className={cx(
                styles.inspectButton,
                styles.iconButton,
                detailsDisplayed(rowIndex) && styles.activeIconButton
              )}
              tooltip={t('explore.logs-table.action-buttons.show-details', 'Show details')}
              aria-label={t('explore.logs-table.action-buttons.show-details', 'Show details')}
              tooltipPlacement="top"
              size="md"
              name="eye"
              onClick={handleDetailsClick}
              tabIndex={0}
            />
          </div>
        )}
        {buildLinkToLog && (
          <div className={styles.buttonWrapper}>
            <ClipboardButton
              className={styles.clipboardButton}
              icon="share-alt"
              variant="secondary"
              fill="text"
              size="md"
              tooltip={t('explore.logs-table.action-buttons.copy-link', 'Copy link to log line')}
              tooltipPlacement="top"
              tabIndex={0}
              aria-label={t('explore.logs-table.action-buttons.copy-link', 'Copy link to log line')}
              getText={() => {
                const logId = logsFrame?.idField?.values?.[rowIndex];
                if (logId) {
                  return buildLinkToLog(logId) ?? '';
                } else {
                  console.error('failed to copy log line link!');
                }
                return '';
              }}
            />
          </div>
        )}
        {reserveErrorAttributeSpace &&
          (errorAttributeKind ? (
            <ErrorAttributeIcon kind={errorAttributeKind} />
          ) : (
            <div className={styles.errorIcon} />
          ))}
      </div>
    </>
  );
}

function ErrorAttributeIcon({ kind }: { kind: ErrorAttributeKind }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const copy = useMemo(
    () =>
      kind === 'stacktrace'
        ? {
            content: t(
              'explore.logs-table.error-attribute.stacktrace-tooltip',
              'This log line contains a stack trace.'
            ),
            label: t('explore.logs-table.error-attribute.stacktrace-label', 'Has a stack trace'),
          }
        : {
            content: t(
              'explore.logs-table.error-attribute.error-fields-tooltip',
              'This log line contains error-related fields.'
            ),
            label: t('explore.logs-table.error-attribute.error-fields-label', 'Has error fields'),
          },
    [kind]
  );

  return (
    <div className={styles.errorIcon}>
      <Tooltip content={copy.content} placement="top" theme="info">
        <Icon name="exclamation-circle" aria-label={copy.label} size="xs" />
      </Tooltip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z2,
    display: 'flex',
    flexDirection: 'row',
    height: '100%',
    left: 0,
    top: 0,
    position: 'absolute',
    zIndex: 1,
  }),
  buttonWrapper: css({
    height: '100%',
    '&:hover': {
      color: theme.colors.text.link,
    },
    padding: theme.spacing(0, 0.5),
    display: 'flex',
    alignItems: 'center',
  }),
  errorIcon: css({
    alignItems: 'center',
    color: LogLevelColor[LogLevel.error],
    display: 'flex',
    flexShrink: 0,
    height: '100%',
    justifyContent: 'center',
    width: ERROR_ATTRIBUTE_ICON_WIDTH,
  }),
  inspectButton: css({
    display: 'inline-flex',
    verticalAlign: 'middle',
    cursor: 'pointer',
  }),
  ...getIconButtonStyles(theme),
  clipboardButton: css({
    lineHeight: '1',
    padding: 0,
    width: '20px',
    cursor: 'pointer',
    height: '24px',
  }),
});
