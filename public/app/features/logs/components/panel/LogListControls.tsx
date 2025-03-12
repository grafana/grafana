import { css } from '@emotion/css';
import { useCallback } from 'react';

import { EventBus, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ScrollToLogsEvent } from './virtualization';

type Props = {
  eventBus: EventBus;
};

export const LogListControls = ({ eventBus }: Props) => {
  const styles = useStyles2(getStyles);

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

  return (
    <div className={styles.navContainer}>
      <IconButton
        name="arrow-down"
        data-testid="scrollToBottom"
        className={styles.controlButton}
        variant="secondary"
        onClick={onScrollToBottomClick}
        tooltip={t('logs.logs-controls.scroll-bottom', 'Scroll to bottom')}
        size="md"
      />
      <IconButton
        name="clock-nine"
        className={styles.controlButton}
        variant="secondary"
        onClick={onScrollToBottomClick}
        tooltip={t('logs.logs-controls.show-timestamps', 'Show timestamps')}
        size="md"
      />
      <IconButton
        name="wrap-text"
        className={styles.controlButton}
        variant="secondary"
        onClick={onScrollToBottomClick}
        tooltip={t('logs.logs-controls.wrap-lines', 'Wrap lines')}
        size="md"
      />
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
      gap: theme.spacing(2.5),
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
    }),
  };
};
