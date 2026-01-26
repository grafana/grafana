import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { useQueryRunnerContext } from '../QueryEditorContext';

import { SidebarCard } from './SidebarCard';
import { SidebarDivider } from './SidebarDivider';

export enum SidebarSize {
  Mini = 'mini',
  Full = 'full',
}
interface QueryEditorSidebarProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
}

export const QueryEditorSidebar = memo(function QueryEditorSidebar({
  sidebarSize,
  setSidebarSize,
}: QueryEditorSidebarProps) {
  const styles = useStyles2(getStyles);
  const isMini = sidebarSize === SidebarSize.Mini;
  const { queries } = useQueryRunnerContext();

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          icon={isMini ? 'expand-alt' : 'compress-alt'}
          size="sm"
          variant="secondary"
          onClick={toggleSize}
          aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        />
        <Text weight="medium" variant="h6">
          {t('query-editor-next.sidebar.queries', 'Queries')}
        </Text>
      </div>
      <SidebarDivider text={t('query-editor-next.sidebar.divider-text', 'Queries & Expressions')} />
      <div className={styles.body}>
        {queries.map((query) => (
          <SidebarCard key={query.refId} query={query} />
        ))}
      </div>
    </div>
  );
});

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      position: 'relative',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
    }),
    header: css({
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    body: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
}
