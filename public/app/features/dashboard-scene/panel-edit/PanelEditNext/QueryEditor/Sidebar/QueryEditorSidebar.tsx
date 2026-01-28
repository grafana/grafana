import { css } from '@emotion/css';
import { memo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CollapsableSection, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { usePanelContext, useQueryRunnerContext } from '../QueryEditorContext';
import { isDataTransformerConfig } from '../utils';

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
  const { transformations } = usePanelContext();
  const [queriesIsOpen, setQueriesIsOpen] = useState(true);
  const [transformationsIsOpen, setTransformationsIsOpen] = useState(true);

  const toggleSize = () => {
    setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini);
  };

  return (
    <div className={styles.container}>
      <Stack direction="row" alignItems="center" gap={1}>
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
      </Stack>
      <CollapsableSection
        label={
          <Text color="secondary" variant="body">
            {t('query-editor-next.sidebar.queries-expressions', 'Queries & Expressions')}
          </Text>
        }
        isOpen={queriesIsOpen}
        onToggle={setQueriesIsOpen}
        contentClassName={styles.collapsableSectionContent}
      >
        <Stack direction="column" gap={1}>
          {queries.map((query) => (
            <SidebarCard key={query.refId} query={query} />
          ))}
        </Stack>
      </CollapsableSection>
      <CollapsableSection
        label={
          <Text color="secondary" variant="body">
            {t('query-editor-next.sidebar.transformations', 'Transformations')}
          </Text>
        }
        isOpen={transformationsIsOpen}
        onToggle={setTransformationsIsOpen}
        contentClassName={styles.collapsableSectionContent}
      >
        <Stack direction="column" gap={1}>
          {transformations.map((transformation) => {
            if (isDataTransformerConfig(transformation)) {
              return <SidebarCard key={transformation.id} query={transformation} />;
            }
            return null;
          })}
        </Stack>
      </CollapsableSection>
    </div>
  );
});

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
      position: 'relative',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
    }),
    collapsableSectionContent: css({
      padding: 0,
    }),
  };
}
