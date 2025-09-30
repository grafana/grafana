import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Drawer, useStyles2 } from '@grafana/ui';
import { RichHistoryQuery } from 'app/types/explore';

import { QueryHistoryContent } from './QueryHistoryContent';
import { QueryHistoryDrawerOptions } from './QueryHistoryContext';

export interface QueryHistoryDrawerProps {
  isOpen: boolean;
  close: () => void;
  activeDatasources: string[];
  onSelectQuery?: (query: any) => void;
  options?: QueryHistoryDrawerOptions['options'];
}

export function QueryHistoryDrawer({
  isOpen,
  close,
  activeDatasources,
  onSelectQuery,
  options,
}: QueryHistoryDrawerProps) {
  const styles = useStyles2(getStyles);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    if (isOpen && !tracked) {
      setTracked(true);
      reportInteraction('grafana_query_history_opened', {
        queryHistoryEnabled: config.queryHistoryEnabled,
        context: options?.context || 'unknown',
      });
    }
    // Reset tracked when drawer closes
    if (!isOpen && tracked) {
      setTracked(false);
    }
  }, [isOpen, tracked, options?.context]);

  const handleSelectQuery = (query: RichHistoryQuery) => {
    if (onSelectQuery && query.queries?.[0]) {
      onSelectQuery(query.queries[0]);
      close();
    }
  };

  // Debug logging
  console.log('QueryHistoryDrawer render:', { isOpen, activeDatasources });

  // Only render when explicitly open
  if (!isOpen) {
    console.log('QueryHistoryDrawer: not open, returning null');
    return null;
  }

  console.log('QueryHistoryDrawer: rendering drawer');

  return (
    <Drawer
      title={
        <Trans i18nKey="query-history.drawer.title">
          Query history
        </Trans>
      }
      subtitle={
        <Trans i18nKey="query-history.drawer.subtitle">
          Find and reuse your previous queries
        </Trans>
      }
      onClose={close}
      size="md"
      scrollableContent
    >
      <div className={styles.content}>
        <QueryHistoryContent
          activeDatasources={activeDatasources}
          onSelectQuery={handleSelectQuery}
        />
      </div>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
});
