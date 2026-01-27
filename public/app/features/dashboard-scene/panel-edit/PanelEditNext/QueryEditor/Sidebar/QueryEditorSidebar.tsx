import { css } from '@emotion/css';
import { memo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CollapsableSection, IconButton, Text, useStyles2 } from '@grafana/ui';

import { useQueryRunnerContext } from '../QueryEditorContext';

import { SidebarCard } from './SidebarCard';

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
  const [queriesIsOpen, setQueriesIsOpen] = useState(true);

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <IconButton
          name={isMini ? 'maximize-left' : 'compress-alt-left'}
          size="sm"
          variant="secondary"
          onClick={toggleSize}
          aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        />
        <Text weight="medium" variant="h6">
          {t('query-editor-next.sidebar.query-stack', 'Query Stack')}
        </Text>
      </div>
      <CollapsableSection
        label={
          <Text color="secondary" variant="body">
            {t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
          </Text>
        }
        isOpen={queriesIsOpen}
        onToggle={setQueriesIsOpen}
        className={styles.collapsableSection}
        contentClassName={styles.collapsableSectionContent}
      >
        <div className={styles.body}>
          {queries.map((query) => (
            <SidebarCard key={query.refId} query={query} />
          ))}
        </div>
      </CollapsableSection>
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
    collapsableSection: css({
      alignItems: 'center',
    }),
    collapsableSectionContent: css({
      padding: 0,
    }),
  };
}
