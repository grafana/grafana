import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { buildBreadcrumbs } from 'app/core/components/Breadcrumbs/utils';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { type VariableEditorViewProps } from './VariableEditorView';
import VariablesManagementPage from './VariablesManagementPage';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('./VariableEditorView', () => ({
  VariableEditorView: ({ onBack }: VariableEditorViewProps) => <button onClick={onBack}>Cancel</button>,
}));

const folderUid = 'folder-a';
const folderTitle = 'Folder A';
const folderVariablesUrl = `/dashboards/f/${folderUid}/folder-a/variables`;

const folderVariable = {
  metadata: {
    name: `env--${folderUid}`,
    annotations: { [AnnoKeyFolder]: folderUid },
  },
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  spec: {
    kind: 'CustomVariable',
    spec: { name: 'env', query: 'dev,prod' },
  } as unknown as VariableSpec,
};

function renderPage(url: string) {
  const grafanaContext = getGrafanaContextMock();
  const result = render(
    <GrafanaContext.Provider value={grafanaContext}>
      <Routes>
        <Route path="/dashboards/variables/new" element={<VariablesManagementPage />} />
        <Route path="/dashboards/variables/edit/:name" element={<VariablesManagementPage />} />
      </Routes>
    </GrafanaContext.Provider>,
    { historyOptions: { initialEntries: [url] } }
  );
  const getBreadcrumbTexts = () => {
    const { sectionNav, pageNav } = grafanaContext.chrome.state.getValue();
    return buildBreadcrumbs(sectionNav.node, pageNav).map((crumb) => crumb.text);
  };
  return { ...result, getBreadcrumbTexts };
}

describe('VariablesManagementPage editor navigation', () => {
  beforeEach(() => {
    // foldersAppPlatformAPI defaults to on; the legacy folder API is simpler to stub.
    setTestFlags({ 'grafana.dashboardGlobalVariables': true, foldersAppPlatformAPI: false });
    server.use(
      http.get(`/api/folders/${folderUid}`, () =>
        HttpResponse.json({
          uid: folderUid,
          title: folderTitle,
          url: `/dashboards/f/${folderUid}/folder-a`,
          canEdit: true,
          parents: [],
        })
      ),
      http.get('/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/variables', () =>
        HttpResponse.json({
          kind: 'VariableList',
          apiVersion: 'dashboard.grafana.app/v2beta1',
          metadata: {},
          items: [folderVariable],
        })
      )
    );
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // setTestFlags fires OpenFeature events that update the still-mounted component.
    await act(async () => {
      setTestFlags({});
    });
  });

  it('nests a new variable under the folder Variables tab it was opened from', async () => {
    const { user, getBreadcrumbTexts } = renderPage(`/dashboards/variables/new?folderUid=${folderUid}`);

    await waitFor(() => expect(getBreadcrumbTexts().slice(-3)).toEqual([folderTitle, 'Variables', 'New variable']));

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(locationService.getLocation().pathname).toBe(folderVariablesUrl);
  });

  it('nests an edited variable under the folder Variables tab it was opened from', async () => {
    const { user, getBreadcrumbTexts } = renderPage(
      `/dashboards/variables/edit/${folderVariable.metadata.name}?folderUid=${folderUid}`
    );

    await waitFor(() => expect(getBreadcrumbTexts().slice(-3)).toEqual([folderTitle, 'Variables', 'env']));

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(locationService.getLocation().pathname).toBe(folderVariablesUrl);
  });

  it('returns to the global variables list when not opened from a folder', async () => {
    const { user, getBreadcrumbTexts } = renderPage('/dashboards/variables/new');

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(getBreadcrumbTexts()).not.toContain(folderTitle);
    expect(locationService.getLocation().pathname).toBe('/dashboards/variables');
  });
});
