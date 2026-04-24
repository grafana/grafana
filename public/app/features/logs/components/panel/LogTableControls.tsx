import { css, cx } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { CoreApp, type GrafanaTheme2, LogsSortOrder, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Dropdown, Menu, usePanelContext, useStyles2 } from '@grafana/ui';

import { DownloadFormat } from '../../utils';

import { CONTROLS_WIDTH_EXPANDED } from './LogListControls';
import { LogListControlsOption } from './LogListControlsOption';
import { LOG_LIST_CONTROLS_WIDTH } from './virtualization';

type Props = {
  allowDownload?: boolean;
  controlsExpanded: boolean;
  setControlsExpanded: (expanded: boolean) => void;
  setSortOrder: (sortOrder: LogsSortOrder) => void;
  logOptionsStorageKey: string;
  sortOrder: LogsSortOrder;
  downloadLogs: (format: DownloadFormat) => void;
  onWrapTextClick: () => void;
  wrapText: boolean;
};

export const LogTableControls = ({
  allowDownload,
  controlsExpanded,
  logOptionsStorageKey,
  setControlsExpanded,
  setSortOrder,
  sortOrder,
  downloadLogs,
  onWrapTextClick,
  wrapText,
}: Props) => {
  const styles = useStyles2(getStyles, controlsExpanded);
  const { app } = usePanelContext();

  const onExpandControlsClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_expand_controls_clicked');
    setControlsExpanded(!controlsExpanded);
    store.set(`${logOptionsStorageKey}.controlsExpanded`, !controlsExpanded);
  }, [controlsExpanded, logOptionsStorageKey, setControlsExpanded]);

  const onSortOrderClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_sort_order_clicked', {
      order: sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending,
    });
    setSortOrder(sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending);
  }, [setSortOrder, sortOrder]);

  const downloadMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item
          label={t('logs.logs-controls.download-logs.txt', 'txt')}
          onClick={() => {
            downloadLogs(DownloadFormat.Text);
            reportInteraction('logs_log_list_controls_downloaded_logs', {
              format: DownloadFormat.Text,
            });
          }}
        />
        <Menu.Item
          label={t('logs.logs-controls.download-logs.json', 'json')}
          onClick={() => {
            downloadLogs(DownloadFormat.Json);
            reportInteraction('logs_log_list_controls_downloaded_logs', {
              format: DownloadFormat.Json,
            });
          }}
        />
        <Menu.Item
          label={t('logs.logs-controls.download-logs.csv', 'csv')}
          onClick={() => {
            downloadLogs(DownloadFormat.CSV);
            reportInteraction('logs_log_list_controls_downloaded_logs', {
              format: DownloadFormat.CSV,
            });
          }}
        />
      </Menu>
    ),
    [downloadLogs]
  );

  const inDashboard = app === CoreApp.Dashboard || app === CoreApp.PanelEditor || app === CoreApp.PanelViewer;
  const canDownload = (inDashboard && allowDownload === true) || (!inDashboard && !config.exploreHideLogsDownload);

  return (
    <div className={styles.navContainer}>
      <LogListControlsOption
        expanded={controlsExpanded}
        name="arrow-from-right"
        className={cx(styles.controlButton, styles.controlsExpandedButton)}
        variant="secondary"
        onClick={onExpandControlsClick}
        label={
          controlsExpanded
            ? t('logs.logs-controls.label.collapse', 'Expanded')
            : t('logs.logs-controls.label.expand', 'Collapsed')
        }
        tooltip={
          controlsExpanded ? t('logs.logs-controls.collapse', 'Collapse') : t('logs.logs-controls.expand', 'Expand')
        }
        size="lg"
      />

      <LogListControlsOption
        expanded={controlsExpanded}
        name={sortOrder === LogsSortOrder.Descending ? 'sort-amount-up' : 'sort-amount-down'}
        className={styles.controlButton}
        onClick={onSortOrderClick}
        label={
          sortOrder === LogsSortOrder.Descending
            ? t('logs.logs-controls.labels.newest-first', 'Newest logs first')
            : t('logs.logs-controls.labels.oldest-first', 'Oldest logs first')
        }
        tooltip={
          sortOrder === LogsSortOrder.Descending
            ? t('logs.logs-controls.newest-first', 'Sorted by newest logs first - Click to show oldest first')
            : t('logs.logs-controls.oldest-first', 'Sorted by oldest logs first - Click to show newest first')
        }
        size="lg"
      />

      <LogListControlsOption
        expanded={controlsExpanded}
        name="wrap-text"
        className={wrapText ? styles.controlButtonActive : styles.controlButton}
        aria-pressed={wrapText}
        onClick={onWrapTextClick}
        tooltip={
          wrapText
            ? t('logs.logs-controls.table-wrap-text.disable', 'Disable text wrapping')
            : t('logs.logs-controls.table-wrap-text.enable', 'Enable text wrapping')
        }
        label={
          wrapText
            ? t('logs.logs-controls.table-wrap-text.enabled', 'Wrapping enabled')
            : t('logs.logs-controls.table-wrap-text.disabled', 'Wrapping disabled')
        }
      />

      {canDownload && (
        <>
          <div className={styles.divider} />
          <Dropdown overlay={downloadMenu} placement="auto-end">
            <LogListControlsOption
              expanded={controlsExpanded}
              name="download-alt"
              className={styles.controlButton}
              label={t('logs.logs-controls.download', 'Download logs')}
              tooltip={t('logs.logs-controls.tooltip.download', 'Download')}
              size="lg"
            />
          </Dropdown>
        </>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, controlsExpanded: boolean) => {
  return {
    navContainer: css({
      height: '100%',
      display: 'flex',
      flex: '1 0 auto',
      gap: theme.spacing(3),
      flexDirection: 'column',
      justifyContent: 'flex-start',
      width: controlsExpanded ? CONTROLS_WIDTH_EXPANDED : LOG_LIST_CONTROLS_WIDTH,
      paddingTop: theme.spacing(0.75),
      paddingLeft: theme.spacing(1),
      borderLeft: `solid 1px ${theme.colors.border.medium}`,
      minWidth: theme.spacing(4),
      backgroundColor: theme.colors.background.primary,
    }),
    controlsExpandedButton: css({
      transform: !controlsExpanded ? 'rotate(180deg)' : '',
    }),
    controlButton: css({
      margin: 0,
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
    }),
    controlButtonActive: css({
      margin: 0,
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
      '&:after': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        height: 2,
        borderRadius: theme.shape.radius.default,
        bottom: theme.spacing(-1),
        backgroundImage: theme.colors.gradients.brandHorizontal,
        width: theme.spacing(2.25),
        opacity: 1,
      },
    }),
    divider: css({
      borderTop: `solid 1px ${theme.colors.border.medium}`,
      height: 1,
      marginTop: theme.spacing(-0.25),
      marginBottom: theme.spacing(-1.75),
    }),
  };
};
