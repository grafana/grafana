import { css } from '@emotion/css';
import { memo, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { Container, ScrollContainer, useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { ExpressionDetailView } from './ExpressionDetailView';
import { PanelDataTransformationsTab, PanelDataTransformationsTabRendered } from './PanelDataTransformationsTab';
import { QueryDetailView } from './QueryDetailView';
import { QueryTransformItem } from './QueryTransformList';
import { TabId } from './types';

interface DetailViewProps {
  selectedItem: QueryTransformItem | undefined;
  panel: VizPanel;
  tabs: Array<{ tabId: TabId }>;
}

export const DetailView = memo(({ selectedItem, panel, tabs }: DetailViewProps) => {
  const styles = useStyles2(getStyles);

  const renderContent = useCallback(() => {
    if (!selectedItem) {
      return (
        <div className={styles.emptyState}>
          <p>
            <Trans i18nKey="dashboard-scene.panel-data-pane.empty-state">
              Select a query or transformation to edit
            </Trans>
          </p>
        </div>
      );
    }

    if (selectedItem.type === 'query' && 'refId' in selectedItem.data) {
      const query = selectedItem.data;
      return (
        <ScrollContainer>
          <QueryDetailView panel={panel} query={query} queryIndex={selectedItem.index} />
        </ScrollContainer>
      );
    } else if (selectedItem.type === 'expression' && 'refId' in selectedItem.data) {
      const data = selectedItem.data;
      if (isExpressionQuery(data)) {
        return (
          <ScrollContainer>
            <ExpressionDetailView panel={panel} expression={data} expressionIndex={selectedItem.index} />
          </ScrollContainer>
        );
      }
    } else {
      const transformsTab = tabs.find((t) => t.tabId === TabId.Transformations);
      if (transformsTab instanceof PanelDataTransformationsTab && 'id' in selectedItem.data) {
        return (
          <ScrollContainer>
            <Container>
              <PanelDataTransformationsTabRendered model={transformsTab} />
            </Container>
          </ScrollContainer>
        );
      }
    }

    return null;
  }, [selectedItem, panel, tabs, styles.emptyState]);

  return <div className={styles.container}>{renderContent()}</div>;
});

DetailView.displayName = 'DetailView';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: theme.colors.background.primary,
    }),
    emptyState: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.h5.fontSize,
    }),
  };
};
