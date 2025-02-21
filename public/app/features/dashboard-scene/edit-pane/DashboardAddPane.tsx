import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Box, Card, Icon, Stack, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';

export interface Props {
  editPane: DashboardEditPane;
}

export function DashboardAddPane({ editPane }: Props) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(editPane);

  return (
    <Box display={'flex'} direction={'column'} gap={1} padding={2}>
      <Card
        key="add-panel-button"
        isCompact={true}
        onClick={() => dashboard.onCreateNewPanel()}
        data-testid={selectors.components.PageToolbar.itemButton('add_visualization')}
      >
        <Card.Heading className={styles.heading}>
          <Icon name="plus" size="lg" />
          <Trans i18nKey="dashboard.toolbar.add-panel">Panel</Trans>
        </Card.Heading>
        <Card.Figure></Card.Figure>
        <Card.Description className={styles.description}>
          The container for visualizations and other widgets.
        </Card.Description>
      </Card>
      <Card
        key="add-panel-button"
        isCompact={true}
        onClick={() => {
          dashboard.onShowAddLibraryPanelDrawer();
          DashboardInteractions.toolbarAddButtonClicked({ item: 'add_library_panel' });
        }}
        data-testid={selectors.pages.AddDashboard.itemButton('Add new panel from panel library menu item')}
      >
        <Card.Heading className={styles.heading}>
          <Icon name="plus" size="lg" /> Import library panel
        </Card.Heading>
        <Card.Description className={styles.description}>
          Libray panels allow you share and reuse panels between dashboards
        </Card.Description>
      </Card>
      <Card
        key="add-panel-button"
        isCompact={true}
        onClick={() => dashboard.onCreateNewRow()}
        data-testid={selectors.components.PageToolbar.itemButton('add_row')}
      >
        <Card.Heading className={styles.heading}>
          <Icon name="plus" size="lg" /> <Trans i18nKey="dashboard.toolbar.add-row">Row</Trans>
        </Card.Heading>
        <Card.Description className={styles.description}>A grouping for panels with optional header</Card.Description>
      </Card>
      <Card
        key="add-panel-button"
        isCompact={true}
        onClick={() => dashboard.onCreateNewTab()}
        data-testid={selectors.components.PageToolbar.itemButton('add_tab')}
      >
        <Card.Heading className={styles.heading}>
          <Icon name="plus" size="lg" /> <Trans i18nKey="dashboard.toolbar.add-tab">Tab</Trans>
        </Card.Heading>
        <Card.Description className={styles.description}>
          Break up your dashboard into different horizontal tabs
        </Card.Description>
      </Card>
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    noBorderTop: css({
      borderTop: 'none',
    }),
    icon: css({
      width: 48,
      height: 48,
    }),
    description: css({
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    heading: css({
      '> button': {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
      },
    }),
    actionsBox: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    }),
  };
}
