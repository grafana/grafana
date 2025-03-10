import { css } from '@emotion/css';
import { useCallback } from 'react';

import { EventBus, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ScrollToLogsEvent } from './virtualization';

type Props = {
  eventBus: EventBus;
};

export const LogListNavigation = ({ eventBus }: Props) => {
  const styles = useStyles2(getStyles);

  const onScrollToTopClick = useCallback(() => {
    reportInteraction('log_list_navigation_scroll_top_clicked');
    eventBus.publish(
      new ScrollToLogsEvent({
        scrollTo: 'top',
      })
    );
  }, [eventBus]);

  const onScrollToBottomClick = useCallback(() => {
    reportInteraction('log_list_navigation_scroll_bottom_clicked');
    eventBus.publish(
      new ScrollToLogsEvent({
        scrollTo: 'bottom',
      })
    );
  }, [eventBus]);

  return (
    <div className={styles.navContainer}>
      <Button
        data-testid="scrollToBottom"
        className={styles.scrollToBottomButton}
        variant="secondary"
        onClick={onScrollToBottomClick}
        title={t('logs.logs-navigation.scroll-bottom', 'Scroll to bottom')}
      >
        <Icon name="arrow-down" size="lg" />
      </Button>
      <Button
        data-testid="scrollToTop"
        className={styles.scrollToTopButton}
        variant="secondary"
        onClick={onScrollToTopClick}
        title={t('logs.logs-navigation.scroll-top', 'Scroll to top')}
      >
        <Icon name="arrow-up" size="lg" />
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    navContainer: css({
      maxHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      position: 'sticky',
      top: theme.spacing(2),
      right: 0,
    }),
    scrollToBottomButton: css({
      width: theme.spacing(3.5),
      height: theme.spacing(3.5),
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      top: 0,
    }),
    scrollToTopButton: css({
      width: theme.spacing(3.5),
      height: theme.spacing(3.5),
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }),
  };
};
