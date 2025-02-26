import { HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockRulerGrafanaRule, mockRulerRuleGroup } from '../mocks';
import {
  mimirDataSource,
  setFolderResponse,
  setPrometheusRules,
  setRulerRuleGroupHandler,
  setRulerRuleGroupResolver,
} from '../mocks/server/configure';
import { alertingFactory } from '../mocks/server/db';

import GroupDetailsPage from './GroupDetailsPage';

const ui = {
  header: byRole('heading', { level: 1 }),
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
  it('should render grafana rules group based on the Ruler API', async () => {
    const group = mockRulerRuleGroup({
      name: 'test-group-cpu',
      interval: '5m',
      rules: [mockRulerGrafanaRule(), mockRulerGrafanaRule()],
    });
    setRulerRuleGroupHandler({ response: HttpResponse.json(group) });
    setFolderResponse({ uid: 'test-folder-uid', canSave: true });

    // Act
    renderGroupDetailsPage('grafana', 'test-folder-uid', 'test-group-cpu');

    const header = await ui.header.find();
    const editLink = await ui.editLink.find();

    // Assert
    expect(header).toHaveTextContent('test-group-cpu');
    expect(await screen.findByText(/test-folder-uid/)).toBeInTheDocument();
    expect(await screen.findByText(/5m/)).toBeInTheDocument();
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

    expect(header).toHaveTextContent('test-group-cpu');
    expect(await screen.findByText(/test-group-cpu/)).toBeInTheDocument();
    expect(await screen.findByText(/8m20s/)).toBeInTheDocument();
    expect(ui.editLink.query()).not.toBeInTheDocument();
  });

  it('should render mimir rules group', async () => {
    const { dataSource: mimirDs } = mimirDataSource();

    const group = alertingFactory.ruler.group.build({ name: 'test-group-cpu', interval: '11m40s' });
    setRulerRuleGroupResolver((req) => {
      if (req.params.namespace === 'test-mimir-namespace' && req.params.groupName === 'test-group-cpu') {
        return HttpResponse.json(group);
      }
      return HttpResponse.json({ error: 'Group not found' }, { status: 404 });
    });

    renderGroupDetailsPage(mimirDs.uid, 'test-mimir-namespace', 'test-group-cpu');

    const header = await ui.header.find();
    const editLink = await ui.editLink.find();

    expect(header).toHaveTextContent('test-group-cpu');
    expect(await screen.findByText(/test-mimir-namespace/)).toBeInTheDocument();
    expect(await screen.findByText(/11m40s/)).toBeInTheDocument();
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
