import { css } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, IconButton, Input, useStyles2 } from '@grafana/ui';

import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface Props {
  log: LogListModel;
}

export const LogLineDetailsHeader = ({ log }: Props) => {
  const { closeDetails, onPermalinkClick } = useLogListContext();
  const styles = useStyles2(getStyles);

  const getLogLine = useCallback(() => {
    return log.entry;
  }, [log]);

  const copyLinkToLogLine = useCallback(() => {
    onPermalinkClick?.(log);
  }, [log, onPermalinkClick]);

  return (
    <div className={styles.header}>
      <Input />
      {onPermalinkClick && log.rowId !== undefined && log.uid && (
        <IconButton
          tooltip={t('logs.log-line-details.copy-shortlink', 'Copy shortlink')}
          aria-label={t('logs.log-line-details.copy-shortlink', 'Copy shortlink')}
          tooltipPlacement="top"
          size="md"
          name="share-alt"
          onClick={copyLinkToLogLine}
          tabIndex={0}
        />
      )}
      <ClipboardButton
        className={styles.copyLogButton}
        icon="copy"
        variant="secondary"
        fill="text"
        size="md"
        getText={getLogLine}
        tooltip={t('logs.log-line-details.copy-to-clipboard', 'Copy to clipboard')}
        tooltipPlacement="top"
        tabIndex={0}
      />
      <IconButton name="times" aria-label={t('logs.log-details.close', 'Close log details')} onClick={closeDetails} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    overflow: 'auto',
    height: '100%',
  }),
  scrollContainer: css({
    overflow: 'auto',
    height: '100%',
  }),
  header: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(0.5),
    zIndex: theme.zIndex.modal,
    height: theme.spacing(5),
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    position: 'sticky',
    top: 0,
  }),
  copyLogButton: css({
    padding: 0,
    height: theme.spacing(4),
    width: theme.spacing(2.5),
    overflow: 'hidden',
  }),
  componentWrapper: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});
