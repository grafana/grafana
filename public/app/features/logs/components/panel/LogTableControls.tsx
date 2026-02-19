import { css, cx } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2, LogsSortOrder, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Dropdown, Menu, useStyles2 } from '@grafana/ui';

import { DownloadFormat } from '../../utils';

import { getWrapButtonStyles } from './LogListCommon';
import { CONTROLS_WIDTH_EXPANDED } from './LogListControls';
import { LogListControlsOption, LogListControlsSelectOption } from './LogListControlsOption';
import { LOG_LIST_CONTROLS_WIDTH } from './virtualization';

type Props = {
  controlsExpanded: boolean;
  setControlsExpanded: (expanded: boolean) => void;
  setSortOrder: (sortOrder: LogsSortOrder) => void;
  logOptionsStorageKey: string;
  sortOrder: LogsSortOrder;
  downloadLogs: (format: DownloadFormat) => void;
  wrapLogMessage: boolean;
  setWrapLogMessage: (wrap: boolean) => void;
};

export const LogTableControls = ({
  controlsExpanded,
  logOptionsStorageKey,
  setControlsExpanded,
  setSortOrder,
  sortOrder,
  downloadLogs,
  wrapLogMessage,
  setWrapLogMessage,
}: Props) => {
  const styles = useStyles2(getStyles, controlsExpanded);

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

  console.log('LogTableControls');

  return (
    <div className={styles.navContainer}>
      <>
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
      </>
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

      <WrapLogMessageButton
        expanded={controlsExpanded}
        wrapLogMessage={wrapLogMessage}
        setWrapLogMessage={setWrapLogMessage}
      />

      {!config.exploreHideLogsDownload && (
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

interface LogSelectOptionProps {
  expanded: boolean;
  wrapLogMessage: boolean;
  setWrapLogMessage: (wrap: boolean) => void;
}

const WrapLogMessageButton = ({ expanded, wrapLogMessage, setWrapLogMessage }: LogSelectOptionProps) => {
  const styles = useStyles2(getWrapButtonStyles, expanded);

  /**
   * This component currently controls two internal states: line wrapping and JSON formatting.
   * The state transition is as follows:
   * - Line wrapping and JSON formatting disabled.
   * - Line wrapping enabled.
   * - Line wrapping and JSON formatting enabled.
   *
   * Line wrapping also controls JSON formatting, because with line wrapping disabled,
   * JSON formatting has no effect, so one is related with the other.
   */
  const disable = useCallback(() => {
    setWrapLogMessage(false);
    reportInteraction('logs_table_log_list_controls_wrap_clicked', {
      state: false,
      prettify: false,
    });
  }, [setWrapLogMessage]);

  const wrap = useCallback(() => {
    setWrapLogMessage(true);
    reportInteraction('logs_table_log_list_controls_wrap_clicked', {
      state: true,
      prettify: false,
    });
  }, [setWrapLogMessage]);

  const wrappingMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item
          label={t('logs.logs-controls.line-wrapping.hide', 'Disable line wrapping')}
          className={!wrapLogMessage ? styles.menuItemActive : undefined}
          onClick={disable}
        />
        <Menu.Item
          label={t('logs.logs-controls.line-wrapping.enable', 'Enable line wrapping')}
          className={wrapLogMessage ? styles.menuItemActive : undefined}
          onClick={wrap}
        />
      </Menu>
    ),
    [disable, styles.menuItemActive, wrap, wrapLogMessage]
  );

  const wrapStateText = !wrapLogMessage
    ? t('logs.logs-controls.line-wrapping.state.hide', 'Wrap disabled')
    : t('logs.logs-controls.line-wrapping.state.wrap', 'Wrap lines');

  const tooltip = t('logs.logs-controls.line-wrapping.tooltip', 'Set line wrap');

  return (
    <LogListControlsSelectOption
      expanded={expanded}
      name={'wrap-text'}
      isActive={wrapLogMessage}
      dropdown={wrappingMenu}
      tooltip={tooltip}
      label={wrapStateText}
      buttonAriaLabel={tooltip}
      customTagText={''}
    />
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
    divider: css({
      borderTop: `solid 1px ${theme.colors.border.medium}`,
      height: 1,
      marginTop: theme.spacing(-0.25),
      marginBottom: theme.spacing(-1.75),
    }),
  };
};
