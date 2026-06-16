import { css } from '@emotion/css';
import { useCallback, useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Badge, Modal, Tab, TabsBar, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueriesLayout } from './RecentQueriesLayout';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (query: DataQuery, datasourceName?: string) => void;
};

export function RecentQueriesModal({ isOpen, onClose, onSelectQuery }: Props) {
  const styles = useStyles2(getStyles);

  const reportAnalytics = useCallback((event: string, properties?: Record<string, string | boolean | undefined>) => {
    reportInteraction('grafana_explore_query_history_recent_queries', { event, ...properties });
  }, []);

  useEffect(() => {
    if (isOpen) {
      reportAnalytics('opened');
    }
  }, [isOpen, reportAnalytics]);

  const handleSelectQuery = useCallback(
    (query: RichHistoryQuery) => {
      reportAnalytics('querySelected', { datasourceName: query.datasourceName });
      onSelectQuery(query.queries[0], query.datasourceName);
    },
    [onSelectQuery, reportAnalytics]
  );

  const modalTitle = (
    <div className={styles.titleColumn}>
      <div className={styles.titleRow}>
        <TabsBar className={styles.tabsBar} hideBorder>
          <Tab label={t('recent-queries.modal.tabs.recent', 'Recent queries')} active={true} onChangeTab={() => {}} />
          <Tooltip
            content={t(
              'recent-queries.modal.tabs.saved-tooltip',
              'Saved queries are available in Cloud and Enterprise.'
            )}
            placement="bottom"
          >
            <Tab
              label={t('recent-queries.modal.tabs.saved', 'Saved queries')}
              active={false}
              onChangeTab={() => {}}
              disabled={true}
              suffix={({ className }) => (
                <span className={className}>
                  <Badge
                    text={t('recent-queries.modal.tabs.saved-badge', 'Cloud')}
                    color="blue"
                    icon="info-circle"
                    className={styles.cloudBadge}
                  />
                </span>
              )}
            />
          </Tooltip>
        </TabsBar>
      </div>
      <Text color="secondary">
        {t(
          'recent-queries.description',
          "Recent queries are queries that you've run in Explore within the past two weeks"
        )}
      </Text>
    </div>
  );

  return (
    <Modal
      title={modalTitle}
      ariaLabel={t('recent-queries.modal.aria-label', 'Recent queries')}
      isOpen={isOpen}
      onDismiss={onClose}
      className={styles.modal}
      contentClassName={styles.content}
    >
      <RecentQueriesLayout onSelectQuery={handleSelectQuery} onClose={onClose} onAnalyticsEvent={reportAnalytics} />
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '90vw',
    maxWidth: '1400px',
    '& [class*="modalHeader"]': {
      // Title is a tall column (tabs + description), so top-align the header row
      // to keep the close button near the top instead of vertically centered.
      alignItems: 'flex-start',
      '> div:last-child': {
        flexGrow: 0,
        marginLeft: theme.spacing(2),
      },
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(3),
    },
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    height: '70vh',
    overflow: 'hidden',
    padding: 0,
  }),
  titleColumn: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: theme.spacing(3),
  }),
  titleRow: css({
    display: 'flex',
    flex: 1,
    alignItems: 'flex-end',
  }),
  tabsBar: css({
    marginBottom: 0,
  }),
  cloudBadge: css({
    '& svg': {
      marginRight: 0,
    },
  }),
});
