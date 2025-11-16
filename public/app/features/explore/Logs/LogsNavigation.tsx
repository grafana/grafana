import { css } from '@emotion/css';
import { memo, useCallback } from 'react';

import { GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Icon, useTheme2 } from '@grafana/ui';
import { getChromeHeaderLevelHeight } from 'app/core/components/AppChrome/TopBar/useChromeHeaderHeight';

type Props = {
  logsSortOrder?: LogsSortOrder | null;
  scrollToTopLogs: () => void;
  scrollToBottomLogs?: () => void;
};

function LogsNavigation({ logsSortOrder, scrollToTopLogs }: Props) {
  const oldestLogsFirst = logsSortOrder === LogsSortOrder.Ascending;
  const theme = useTheme2();
  const styles = getStyles(theme, oldestLogsFirst);

  const onScrollToTopClick = useCallback(() => {
    reportInteraction('grafana_explore_logs_scroll_top_clicked');
    scrollToTopLogs();
  }, [scrollToTopLogs]);

  return (
    <div className={styles.navContainer}>
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
}

export default memo(LogsNavigation);

const getStyles = (theme: GrafanaTheme2, oldestLogsFirst: boolean) => {
  const navContainerHeight = `calc(100vh - 2*${theme.spacing(2)} - 2*${getChromeHeaderLevelHeight()}px)`;

  return {
    navContainer: css({
      maxHeight: navContainerHeight,
      width: oldestLogsFirst && !config.featureToggles.newLogsPanel ? '58px' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      position: 'sticky',
      top: theme.spacing(2),
      right: 0,
    }),
    scrollToBottomButton: css({
      width: '40px',
      height: '40px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      top: 0,
    }),
    scrollToTopButton: css({
      width: '40px',
      height: '40px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing(1),
    }),
  };
};
