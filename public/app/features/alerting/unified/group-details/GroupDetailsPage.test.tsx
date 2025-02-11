import { Route, Routes } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';

import { mockFolderApi, setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { mimirDataSource, setFolderResponse, setPrometheusRules } from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import GroupDetailsPage from './GroupDetailsPage';

const ui = {
  header: byRole('heading', { level: 1 }),
  nameDefinition: byRole('definition', { name: 'Name' }),
  intervalDefinition: byRole('definition', { name: 'Interval' }),
  editLink: byRole('link', { name: 'Edit' }),
};

setupMswServer();
grantUserPermissions([
  AccessControlAction.AlertingRuleRead,
  AccessControlAction.AlertingRuleUpdate,
  AccessControlAction.AlertingRuleExternalRead,
  AccessControlAction.AlertingRuleExternalWrite,
]);

describe('GroupDetailsPage', () => {
  it('should render grafana rules group', async () => {
    const group = alertingFactory.prometheus.group.build({ name: 'test-group-cpu', interval: 300 });
    setPrometheusRules({ uid: 'grafana' }, [group]);
    setFolderResponse({ uid: 'test-folder-uid', canSave: true });

    // Act
    renderGroupDetailsPage('grafana', 'test-folder-uid', 'test-group-cpu');

    const header = await ui.header.find();
    const nameDefinition = await ui.nameDefinition.find();
    const intervalDefinition = await ui.intervalDefinition.find();
    const editLink = await ui.editLink.find();

    // Assert
    expect(header).toHaveTextContent('test-group-cpu');
    expect(nameDefinition).toHaveTextContent('test-group-cpu');
    expect(intervalDefinition).toHaveTextContent('5m');
    expect(editLink).toHaveAttribute('href', '/alerting/grafana/namespaces/test-folder-uid/groups/test-group-cpu/edit');
  });

  it('should render vanilla prometheus rules group', async () => {
    const promDs = alertingFactory.dataSource.build({ uid: 'prometheus', name: 'Prometheus' });
    const group = alertingFactory.prometheus.group.build({ name: 'test-group-cpu', interval: 500 });
    setPrometheusRules({ uid: promDs.uid }, [group]);

    // Act
    renderGroupDetailsPage(promDs.uid, 'test-prom-namespace', 'test-group-cpu');

    // Assert
    const header = await ui.header.find();
    const nameDefinition = await ui.nameDefinition.find();
    const intervalDefinition = await ui.intervalDefinition.find();

    expect(header).toHaveTextContent('test-group-cpu');
    expect(nameDefinition).toHaveTextContent('test-group-cpu');
    expect(intervalDefinition).toHaveTextContent('8m20s');
    expect(ui.editLink.query()).not.toBeInTheDocument();
  });

  it('should render mimir rules group', async () => {
    const { dataSource: mimirDs } = mimirDataSource();
    const group = alertingFactory.prometheus.group.build({ name: 'test-group-cpu', interval: 700 });
    setPrometheusRules({ uid: mimirDs.uid }, [group]);

    renderGroupDetailsPage(mimirDs.uid, 'test-mimir-namespace', 'test-group-cpu');

    const header = await ui.header.find();
    const nameDefinition = await ui.nameDefinition.find();
    const intervalDefinition = await ui.intervalDefinition.find();
    const editLink = await ui.editLink.find();

    expect(header).toHaveTextContent('test-group-cpu');
    expect(nameDefinition).toHaveTextContent('test-group-cpu');
    expect(intervalDefinition).toHaveTextContent('11m40s');
    expect(editLink).toHaveAttribute(
      'href',
      `/alerting/${mimirDs.uid}/namespaces/test-mimir-namespace/groups/test-group-cpu/edit`
    );
  });
});

function renderGroupDetailsPage(dsUid: string, namespaceId: string, groupName: string) {
  render(
    <Routes>
      <Route path="/alerting/:sourceId/namespaces/:namespaceId/groups/:groupName/view" element={<GroupDetailsPage />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/alerting/${dsUid}/namespaces/${namespaceId}/groups/${groupName}/view`] },
    }
  );
}
