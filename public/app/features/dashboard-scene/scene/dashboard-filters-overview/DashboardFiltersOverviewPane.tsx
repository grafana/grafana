import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneComponentProps, sceneGraph, SceneObjectBase, sceneUtils } from '@grafana/scenes';
import { Box, IconButton, Text, useStyles2 } from '@grafana/ui';

import { DashboardEditPane } from '../../edit-pane/DashboardEditPane';

import { DashboardFiltersOverview } from './DashboardFiltersOverview';
import { DashboardFiltersOverviewSearch } from './DashboardFiltersOverviewSearch';

export class DashboardFiltersOverviewPane extends SceneObjectBase {
  public static Component = DashboardFiltersOverviewPaneRenderer;

  public getId() {
    return 'filters' as const;
  }
}

export function DashboardFiltersOverviewPaneRenderer({ model }: SceneComponentProps<DashboardFiltersOverviewPane>) {
  const editPane = sceneGraph.getAncestor(model, DashboardEditPane);
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const { variables } = sceneGraph.getVariables(model)!.useState();
  const adHocVar = variables.find((v) => sceneUtils.isAdHocVariable(v));
  const groupByVar = variables.find((v) => sceneUtils.isGroupByVariable(v));

  return (
    <Box display="flex" direction="column" flex={1} height="100%" minHeight={0}>
      <div className={styles.header}>
        <IconButton
          name="times"
          size="lg"
          onClick={() => editPane.closePane()}
          aria-label={t('dashboard.filters-overview.close', 'Close')}
        />
        <div className={styles.title}>
          <Text variant="h6">{t('dashboard.filters-overview.title', 'Edit filters')}</Text>
        </div>
        <DashboardFiltersOverviewSearch value={searchQuery} onChange={setSearchQuery} />
      </div>
      <div className={cx(styles.content, styles.body)}>
        <DashboardFiltersOverview
          adhocFilters={adHocVar}
          groupByVariable={groupByVar}
          onClose={() => editPane.closePane()}
          searchQuery={searchQuery}
        />
      </div>
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
    minWidth: 0,
  }),
  title: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
    height: '100%',
    boxSizing: 'border-box',
  }),
  body: css({
    flex: 1,
    minHeight: 0,
    height: '100%',
  }),
});
