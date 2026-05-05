import { css } from '@emotion/css';
import { useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Badge, Modal, Tab, TabsBar, Tooltip, useStyles2 } from '@grafana/ui';
import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueriesLayout } from './RecentQueriesLayout';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (query: DataQuery, datasourceName?: string) => void;
};

export function RecentQueriesModal({ isOpen, onClose, onSelectQuery }: Props) {
  const styles = useStyles2(getStyles);

  const handleSelectQuery = useCallback(
    (query: RichHistoryQuery) => {
      onSelectQuery(query.queries[0], query.datasourceName);
    },
    [onSelectQuery]
  );

  const modalTitle = (
    <div className={styles.titleRow}>
      <TabsBar className={styles.tabsBar}>
        <Tab label={t('recent-queries.modal.tabs.recent', 'Recent queries')} active={true} onChangeTab={() => {}} />
        <Tooltip
          content={t('recent-queries.modal.tabs.saved-tooltip', 'Saved queries is available in Cloud and Enterprise')}
          placement="bottom"
        >
          <Tab
            label={t('recent-queries.modal.tabs.saved', 'Saved queries')}
            active={false}
            onChangeTab={() => {}}
            disabled={true}
            suffix={() => (
              <Badge text={t('recent-queries.modal.tabs.saved-badge', 'Cloud')} color="blue" icon="grafana" />
            )}
          />
        </Tooltip>
      </TabsBar>
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
      <RecentQueriesLayout onSelectQuery={handleSelectQuery} onClose={onClose} />
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '90vw',
    maxWidth: '1400px',
    '& [class*="modalHeader"]': {
      '> div:last-child': {
        flexGrow: 0,
        marginLeft: theme.spacing(2),
      },
      paddingTop: theme.spacing(1),
      paddingBottom: 0,
    },
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    height: '70vh',
    overflow: 'hidden',
    padding: 0,
  }),
  titleRow: css({
    display: 'flex',
    flex: 1,
    alignItems: 'flex-end',
  }),
  tabsBar: css({
    borderBottom: 'none',
    marginBottom: 0,
  }),
});
