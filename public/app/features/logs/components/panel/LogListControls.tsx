import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { useCallback, useMemo } from 'react';

import {
  CoreApp,
  EventBus,
  GrafanaTheme2,
  LogsDedupDescription,
  LogsDedupStrategy,
  LogsSortOrder,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Dropdown, IconButton, Menu, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useLogListContext } from './LogListContext';
import { ScrollToLogsEvent } from './virtualization';

type Props = {
  app: CoreApp;
  eventBus: EventBus;
};

const DEDUP_OPTIONS = [
  LogsDedupStrategy.none,
  LogsDedupStrategy.exact,
  LogsDedupStrategy.numbers,
  LogsDedupStrategy.signature,
];

export const LogListControls = ({ app, eventBus }: Props) => {
  const styles = useStyles2(getStyles);
  const {
    dedupStrategy,
    setDedupStrategy,
    setShowTime,
    setSortOrder,
    setSyntaxHighlighting,
    setWrapLogMessage,
    showTime,
    sortOrder,
    syntaxHighlighting,
    wrapLogMessage,
  } = useLogListContext();

  const onScrollToTopClick = useCallback(() => {
    reportInteraction('log_list_controls_scroll_top_clicked');
    eventBus.publish(
      new ScrollToLogsEvent({
        scrollTo: 'top',
      })
    );
  }, [eventBus]);

  const onScrollToBottomClick = useCallback(() => {
    reportInteraction('log_list_controls_scroll_bottom_clicked');
    eventBus.publish(
      new ScrollToLogsEvent({
        scrollTo: 'bottom',
      })
    );
  }, [eventBus]);

  const onShowTimestampsClick = useCallback(() => {
    setShowTime(!showTime);
  }, [setShowTime, showTime]);

  const onSortOrderClick = useCallback(() => {
    setSortOrder(sortOrder === LogsSortOrder.Ascending ? LogsSortOrder.Descending : LogsSortOrder.Ascending);
  }, [setSortOrder, sortOrder]);

  const onSyntaxHightlightingClick = useCallback(() => {
    setSyntaxHighlighting(!syntaxHighlighting);
  }, [setSyntaxHighlighting, syntaxHighlighting]);

  const onWrapLogMessageClick = useCallback(() => {
    setWrapLogMessage(!wrapLogMessage);
  }, [setWrapLogMessage, wrapLogMessage]);

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

  const inDashboard = app === CoreApp.Dashboard || app === CoreApp.PanelEditor || app === CoreApp.PanelViewer;

  return (
    <div className={styles.navContainer}>
      <IconButton
        name="arrow-down"
        className={styles.controlButton}
        variant="secondary"
        onClick={onScrollToBottomClick}
        tooltip={t('logs.logs-controls.scroll-bottom', 'Scroll to bottom')}
        size="md"
      />
      {!inDashboard && (
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
            size="md"
          />
          <Dropdown overlay={deduplicationMenu} placement="auto-end">
            <IconButton
              name={'filter'}
              className={dedupStrategy !== LogsDedupStrategy.none ? styles.controlButtonActive : styles.controlButton}
              onClick={onSortOrderClick}
              tooltip={t('logs.logs-controls.deduplication', 'Deduplication')}
              size="md"
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
            size="md"
          />
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
            size="md"
          />
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
            size="md"
          />
        </>
      )}
      <IconButton
        name="arrow-up"
        data-testid="scrollToTop"
        className={styles.scrollToTopButton}
        variant="secondary"
        onClick={onScrollToTopClick}
        tooltip={t('logs.logs-controls.scroll-top', 'Scroll to top')}
        size="md"
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    navContainer: css({
      maxHeight: '100%',
      display: 'flex',
      gap: theme.spacing(2),
      flexDirection: 'column',
      justifyContent: 'flex-start',
      width: theme.spacing(3),
      paddingTop: theme.spacing(0.5),
      paddingLeft: theme.spacing(0.5),
    }),
    scrollToTopButton: css({
      margin: 0,
      marginTop: 'auto',
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
        bottom: -6,
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
        top: '4px',
        height: `calc(100% - ${theme.spacing(1)})`,
        width: '2px',
        backgroundColor: theme.colors.warning.main,
      },
    }),
  };
};
