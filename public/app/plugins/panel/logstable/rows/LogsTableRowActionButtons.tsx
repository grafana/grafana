import { css } from '@emotion/css';
import { useCallback } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { ClipboardButton, type CustomCellRendererProps, IconButton } from '@grafana/ui';
import { useTheme2 } from '@grafana/ui/themes';
import { type LogsFrame } from 'app/features/logs/logsFrame';

import { useLogDetailsContext } from '../LogDetailsContext';
import { type BuildLinkToLogLine } from '../types';

interface Props extends CustomCellRendererProps {
  buildLinkToLog?: BuildLinkToLogLine;
  logsFrame: LogsFrame;
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

  const handleDetailsClick = useCallback(() => {
    toggleDetails(rowIndex);
  }, [rowIndex, toggleDetails]);

  return (
    <>
      <div className={styles.container}>
        {enableLogDetails && (
          <div className={styles.buttonWrapper}>
            <IconButton
              className={styles.inspectButton}
              tooltip={t('explore.logs-table.action-buttons.show-details', 'Show details')}
              variant={detailsDisplayed(rowIndex) ? 'primary' : 'secondary'}
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
      </div>
    </>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
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
  inspectButton: css({
    borderRadius: theme.shape.radius.default,
    display: 'inline-flex',
    margin: 0,
    overflow: 'hidden',
    verticalAlign: 'middle',
    cursor: 'pointer',
    height: '24px',
    width: '20px',
  }),
  clipboardButton: css({
    lineHeight: '1',
    padding: 0,
    width: '20px',
    cursor: 'pointer',
    height: '24px',
  }),
});
