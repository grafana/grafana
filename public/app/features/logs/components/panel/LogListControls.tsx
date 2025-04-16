import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { MouseEvent, useCallback, useMemo } from 'react';

import { CoreApp, EventBus, LogLevel, LogsDedupDescription, LogsDedupStrategy, LogsSortOrder } from '@grafana/data';
import { GrafanaTheme2 } from '@grafana/data/';
import { config, reportInteraction } from '@grafana/runtime';
import { Dropdown, IconButton, Menu, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { LogsVisualisationType } from '../../../explore/Logs/Logs';
import { DownloadFormat } from '../../utils';

import { useLogListContext } from './LogListContext';
import { ScrollToLogsEvent } from './virtualization';

type Props = {
  eventBus: EventBus;
  visualisationType?: LogsVisualisationType;
};

const DEDUP_OPTIONS = [
  LogsDedupStrategy.none,
  LogsDedupStrategy.exact,
  LogsDedupStrategy.numbers,
  LogsDedupStrategy.signature,
];

const FILTER_LEVELS: LogLevel[] = [
  LogLevel.info,
  LogLevel.debug,
  LogLevel.trace,
  LogLevel.warning,
  LogLevel.error,
  LogLevel.critical,
];

export const LogListControls = ({ eventBus, visualisationType = 'logs' }: Props) => {
  const styles = useStyles2(getStyles);
  const {
    app,
    dedupStrategy,
    downloadLogs,
    filterLevels,
    forceEscape,
    hasUnescapedContent,
    prettifyJSON,
    setDedupStrategy,
    setFilterLevels,
    setForceEscape,
    setPrettifyJSON,
    setShowTime,
    setShowUniqueLabels,
    setSortOrder,
    setSyntaxHighlighting,
    setWrapLogMessage,
    showTime,
    showUniqueLabels,
    sortOrder,
    syntaxHighlighting,
    wrapLogMessage,
  } = useLogListContext();

  const onScrollToTopClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_scroll_top_clicked');
    eventBus.publish(
      new ScrollToLogsEvent({
        scrollTo: 'top',
      })
    );
  }, [eventBus]);

  const onScrollToBottomClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_scroll_bottom_clicked');
    eventBus.publish(
      new ScrollToLogsEvent({
        scrollTo: 'bottom',
      })
    );
  }, [eventBus]);

  const onForceEscapeClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_force_escape_clicked');
    setForceEscape(!forceEscape);
  }, [forceEscape, setForceEscape]);

  const onFilterLevelClick = useCallback(
    (level?: LogLevel) => {
      reportInteraction('logs_log_list_controls_level_clicked');
      if (level === undefined) {
        setFilterLevels([]);
      } else if (!filterLevels.includes(level)) {
        setFilterLevels([...filterLevels, level]);
      } else {
        setFilterLevels(filterLevels.filter((filterLevel) => filterLevel !== level));
      }
    },
    [filterLevels, setFilterLevels]
  );

  const onShowTimestampsClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_show_time_clicked', {
      show_time: !showTime,
    });
    setShowTime(!showTime);
  }, [setShowTime, showTime]);

  const onShowUniqueLabelsClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_show_unique_labels_clicked', {
      show_unique_labels: showUniqueLabels,
    });
    setShowUniqueLabels(!showUniqueLabels);
  }, [setShowUniqueLabels, showUniqueLabels]);

  const onSortOrderClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_sort_order_clicked', {
      order: sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending,
    });
    setSortOrder(sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending);
  }, [setSortOrder, sortOrder]);

  const onSetPrettifyJSONClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_prettify_json_clicked', {
      state: !prettifyJSON,
    });
    setPrettifyJSON(!prettifyJSON);
  }, [prettifyJSON, setPrettifyJSON]);

  const onSyntaxHightlightingClick = useCallback(() => {
    reportInteraction('logs_log_list_controls_syntax_clicked', {
      state: !syntaxHighlighting,
    });
    setSyntaxHighlighting(!syntaxHighlighting);
  }, [setSyntaxHighlighting, syntaxHighlighting]);

  const onWrapLogMessageClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      reportInteraction('logs_log_list_controls_wrap_clicked', {
        state: !wrapLogMessage,
      });
      setWrapLogMessage(!wrapLogMessage);
    },
    [setWrapLogMessage, wrapLogMessage]
  );

  const deduplicationMenu = useMemo(
    () => (
      <Menu>
        {DEDUP_OPTIONS.map((option) => (
          <Menu.Item
            key={option}
            className={dedupStrategy === option ? styles.menuItemActive : undefined}
            description={LogsDedupDescription[option]}
            label={capitalize(option)}
            onClick={() => setDedupStrategy(option)}
          />
        ))}
      </Menu>
    ),
    [dedupStrategy, setDedupStrategy, styles.menuItemActive]
  );

  const filterLevelsMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item
          key={'all'}
          className={filterLevels.length === 0 ? styles.menuItemActive : undefined}
          label={t('logs.logs-controls.display-level-all', 'All levels')}
          onClick={() => onFilterLevelClick()}
        />
        {FILTER_LEVELS.map((level) => (
          <Menu.Item
            key={level}
            className={filterLevels.includes(level) ? styles.menuItemActive : undefined}
            label={capitalize(level)}
            onClick={() => onFilterLevelClick(level)}
          />
        ))}
      </Menu>
    ),
    [filterLevels, onFilterLevelClick, styles.menuItemActive]
  );

  const downloadMenu = useMemo(
    () => (
      <Menu>
        <Menu.Item
          label={t('logs.logs-controls.download-logs.txt', 'txt')}
          onClick={() => downloadLogs(DownloadFormat.Text)}
        />
        <Menu.Item
          label={t('logs.logs-controls.download-logs.json', 'json')}
          onClick={() => downloadLogs(DownloadFormat.Json)}
        />
        <Menu.Item
          label={t('logs.logs-controls.download-logs.csv', 'csv')}
          onClick={() => downloadLogs(DownloadFormat.CSV)}
        />
      </Menu>
    ),
    [downloadLogs]
  );

  const inDashboard = app === CoreApp.Dashboard || app === CoreApp.PanelEditor || app === CoreApp.PanelViewer;

  return (
    <div className={styles.navContainer}>
      {visualisationType === 'logs' && (
        <IconButton
          name="arrow-down"
          className={styles.controlButton}
          variant="secondary"
          onClick={onScrollToBottomClick}
          tooltip={t('logs.logs-controls.scroll-bottom', 'Scroll to bottom')}
          size="lg"
        />
      )}
      {!inDashboard ? (
        <>
          <IconButton
            name={sortOrder === LogsSortOrder.Descending ? 'sort-amount-up' : 'sort-amount-down'}
            className={styles.controlButton}
            onClick={onSortOrderClick}
            tooltip={
              sortOrder === LogsSortOrder.Descending
                ? t('logs.logs-controls.newest-first', 'Newest logs first')
                : t('logs.logs-controls.oldest-first', 'Oldest logs first')
            }
            size="lg"
          />
          {visualisationType === 'logs' && (
            <>
              <Dropdown overlay={deduplicationMenu} placement="auto-end">
                <IconButton
                  name={'filter'}
                  className={
                    dedupStrategy !== LogsDedupStrategy.none ? styles.controlButtonActive : styles.controlButton
                  }
                  tooltip={t('logs.logs-controls.deduplication', 'Deduplication')}
                  size="lg"
                />
              </Dropdown>
              <Dropdown overlay={filterLevelsMenu} placement="auto-end">
                <IconButton
                  name={'gf-logs'}
                  className={
                    filterLevels && filterLevels.length > 0 ? styles.controlButtonActive : styles.controlButton
                  }
                  tooltip={t('logs.logs-controls.display-level', 'Display levels')}
                  size="lg"
                />
              </Dropdown>
              <IconButton
                name="clock-nine"
                aria-pressed={showTime}
                className={showTime ? styles.controlButtonActive : styles.controlButton}
                onClick={onShowTimestampsClick}
                tooltip={
                  showTime
                    ? t('logs.logs-controls.hide-timestamps', 'Hide timestamps')
                    : t('logs.logs-controls.show-timestamps', 'Show timestamps')
                }
                size="lg"
              />
              {showUniqueLabels !== undefined && (
                <IconButton
                  name="tag-alt"
                  aria-pressed={showUniqueLabels}
                  className={showUniqueLabels ? styles.controlButtonActive : styles.controlButton}
                  onClick={onShowUniqueLabelsClick}
                  tooltip={
                    showUniqueLabels
                      ? t('logs.logs-controls.hide-unique-labels', 'Hide unique labels')
                      : t('logs.logs-controls.show-unique-labels', 'Show unique labels')
                  }
                  size="lg"
                />
              )}
              <IconButton
                name="wrap-text"
                className={wrapLogMessage ? styles.controlButtonActive : styles.controlButton}
                aria-pressed={wrapLogMessage}
                onClick={onWrapLogMessageClick}
                tooltip={
                  wrapLogMessage
                    ? t('logs.logs-controls.unwrap-lines', 'Unwrap lines')
                    : t('logs.logs-controls.wrap-lines', 'Wrap lines')
                }
                size="lg"
              />
              {prettifyJSON !== undefined && (
                <IconButton
                  name="brackets-curly"
                  aria-pressed={prettifyJSON}
                  className={prettifyJSON ? styles.controlButtonActive : styles.controlButton}
                  onClick={onSetPrettifyJSONClick}
                  tooltip={
                    prettifyJSON
                      ? t('logs.logs-controls.disable-prettify-json', 'Collapse JSON logs')
                      : t('logs.logs-controls.prettify-json', 'Expand JSON logs')
                  }
                  size="lg"
                />
              )}
              {syntaxHighlighting !== undefined && (
                <IconButton
                  name="brackets-curly"
                  className={syntaxHighlighting ? styles.controlButtonActive : styles.controlButton}
                  aria-pressed={syntaxHighlighting}
                  onClick={onSyntaxHightlightingClick}
                  tooltip={
                    syntaxHighlighting
                      ? t('logs.logs-controls.disable-highlighting', 'Disable highlighting')
                      : t('logs.logs-controls.enable-highlighting', 'Enable highlighting')
                  }
                  size="lg"
                />
              )}
              {hasUnescapedContent && (
                <IconButton
                  name="enter"
                  aria-pressed={forceEscape}
                  className={forceEscape ? styles.controlButtonActive : styles.controlButton}
                  onClick={onForceEscapeClick}
                  tooltip={
                    forceEscape
                      ? t('logs.logs-controls.remove-escaping', 'Remove escaping')
                      : t(
                          'logs.logs-controls.escape-newlines',
                          'Fix incorrectly escaped newline and tab sequences in log lines'
                        )
                  }
                  size="lg"
                />
              )}
            </>
          )}
          {!config.exploreHideLogsDownload && (
            <>
              <div className={styles.divider} />
              <Dropdown overlay={downloadMenu} placement="auto-end">
                <IconButton
                  name="download-alt"
                  className={styles.controlButton}
                  aria-pressed={wrapLogMessage}
                  tooltip={t('logs.logs-controls.download', 'Download logs')}
                  size="lg"
                />
              </Dropdown>
            </>
          )}
        </>
      ) : (
        <Dropdown overlay={filterLevelsMenu} placement="auto-end">
          <IconButton
            name={'gf-logs'}
            className={filterLevels && filterLevels.length > 0 ? styles.controlButtonActive : styles.controlButton}
            tooltip={t('logs.logs-controls.display-level', 'Display levels')}
            size="lg"
          />
        </Dropdown>
      )}
      {visualisationType === 'logs' && (
        <IconButton
          name="arrow-up"
          data-testid="scrollToTop"
          className={styles.scrollToTopButton}
          variant="secondary"
          onClick={onScrollToTopClick}
          tooltip={t('logs.logs-controls.scroll-top', 'Scroll to top')}
          size="lg"
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    navContainer: css({
      maxHeight: '100%',
      display: 'flex',
      gap: theme.spacing(3),
      flexDirection: 'column',
      justifyContent: 'flex-start',
      width: theme.spacing(4),
      paddingTop: theme.spacing(0.75),
      paddingLeft: theme.spacing(1),
      borderLeft: `solid 1px ${theme.colors.border.medium}`,
    }),
    scrollToTopButton: css({
      margin: 0,
      marginTop: 'auto',
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
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
        width: '95%',
        opacity: 1,
      },
    }),
    menuItemActive: css({
      '&:before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: theme.spacing(0.5),
        height: `calc(100% - ${theme.spacing(1)})`,
        width: '2px',
        backgroundColor: theme.colors.warning.main,
      },
    }),
  };
};
