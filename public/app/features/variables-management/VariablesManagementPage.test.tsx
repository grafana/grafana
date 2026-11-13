import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { render, screen, waitFor } from 'test/test-utils';

import { locationService, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { folderHandlers, setTestFlags } from '@grafana/test-utils/unstable';
import { type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { buildBreadcrumbs } from 'app/core/components/Breadcrumbs/utils';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import { type VariableEditorViewProps } from './VariableEditorView';
import VariablesManagementPage from './VariablesManagementPage';
import { registerSharedVariablesEntryPoint } from './enterprise-components/SharedVariablesEntryPointExtension';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('./VariableEditorView', () => ({
  VariableEditorView: ({ onBack }: VariableEditorViewProps) => <button onClick={onBack}>Cancel</button>,
}));

const folderUid = 'folder-a';
const folderTitle = 'Folder A';
const folderVariablesUrl = `/dashboards/f/${folderUid}/folder-a/variables`;
const folderUrl = `${folderHandlers.FOLDERS}/${folderUid}`;

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
        <Route path="/dashboards/variables" element={<VariablesManagementPage />} />
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
    setTestFlags({ 'grafana.dashboardGlobalVariables': true });
    server.use(
      http.get(folderUrl, () =>
        HttpResponse.json(folderHandlers.buildFolderResource({ uid: folderUid, title: folderTitle }))
      ),
      http.get(`${folderUrl}/access`, () =>
        HttpResponse.json({
          kind: 'FolderAccessInfo',
          apiVersion: 'folder.grafana.app/v1beta1',
          canAdmin: true,
          canDelete: true,
          canEdit: true,
          canSave: true,
        })
      ),
      http.get(`${folderUrl}/parents`, () =>
        HttpResponse.json({
          kind: 'FolderInfoList',
          apiVersion: 'folder.grafana.app/v1beta1',
          metadata: {},
          items: [{ name: folderUid, title: folderTitle }],
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

describe('VariablesManagementPage shared variables entry point', () => {
  beforeEach(() => {
    setTestFlags({ 'grafana.dashboardGlobalVariables': true, foldersAppPlatformAPI: false });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(async () => {
    registerSharedVariablesEntryPoint(null);
    jest.restoreAllMocks();
    await act(async () => {
      setTestFlags({});
    });
  });

  function serveVariables(items: unknown[]) {
    server.use(
      http.get('/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/variables', () =>
        HttpResponse.json({ kind: 'VariableList', apiVersion: 'dashboard.grafana.app/v2beta1', metadata: {}, items })
      )
    );
  }

  it('renders nothing extra until Enterprise registers an entry point', async () => {
    serveVariables([folderVariable]);
    renderPage('/dashboards/variables');

    expect(await screen.findByRole('button', { name: /new variable/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shared variables' })).not.toBeInTheDocument();
  });

  it('renders the registered entry point next to New variable', async () => {
    registerSharedVariablesEntryPoint(() => <button>Shared variables</button>);
    serveVariables([folderVariable]);
    renderPage('/dashboards/variables');

    expect(await screen.findByRole('button', { name: 'Shared variables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new variable/i })).toBeInTheDocument();
  });

  it('keeps the entry point when there are no variables yet', async () => {
    registerSharedVariablesEntryPoint(() => <button>Shared variables</button>);
    serveVariables([]);
    renderPage('/dashboards/variables');

    expect(await screen.findByRole('button', { name: 'Shared variables' })).toBeInTheDocument();
  });
});
