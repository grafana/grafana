import { selectors } from '@grafana/e2e-selectors';
import { Box, Card, Icon } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';

export interface Props {
  editPane: DashboardEditPane;
}

export function DashboardAddPane({ editPane }: Props) {
  const dashboard = getDashboardSceneFor(editPane);

  return (
    <Box display={'flex'} direction={'column'} gap={1} padding={2}>
      <Card
        onClick={() => dashboard.onCreateNewPanel()}
        data-testid={selectors.components.PageToolbar.itemButton('add_visualization')}
        title="The container for visualizations and other widgets"
      >
        <Card.Heading>
          <Trans i18nKey="dashboard.toolbar.add-panel">Panel</Trans>
        </Card.Heading>
        <Card.Figure>
          <Icon name="graph-bar" size="xl" />
        </Card.Figure>
      </Card>
      <Card
        onClick={() => {
          dashboard.onShowAddLibraryPanelDrawer();
          DashboardInteractions.toolbarAddButtonClicked({ item: 'add_library_panel' });
        }}
        data-testid={selectors.pages.AddDashboard.itemButton('Add new panel from panel library menu item')}
        title={'Libray panels allow you share and reuse panels between dashboards'}
      >
        <Card.Heading>Import library panel</Card.Heading>
        <Card.Figure>
          <Icon name="import" size="xl" />
        </Card.Figure>
      </Card>
      <Card
        onClick={() => dashboard.onCreateNewRow()}
        data-testid={selectors.components.PageToolbar.itemButton('add_row')}
        title="A grouping for panels with optional header"
      >
        <Card.Heading>
          <Trans i18nKey="dashboard.toolbar.add-row">Row</Trans>
        </Card.Heading>
        <Card.Figure>
          <Icon name="list-ul" size="xl" />
        </Card.Figure>
      </Card>
      <Card
        onClick={() => dashboard.onCreateNewTab()}
        data-testid={selectors.components.PageToolbar.itemButton('add_tab')}
        title="Break up your dashboard into different horizontal tabs"
      >
        <Card.Heading>
          <Trans i18nKey="dashboard.toolbar.add-tab">Tab</Trans>
        </Card.Heading>
        <Card.Figure>
          <Icon name="layer-group" size="xl" />
        </Card.Figure>
      </Card>
    </Box>
  );
}
