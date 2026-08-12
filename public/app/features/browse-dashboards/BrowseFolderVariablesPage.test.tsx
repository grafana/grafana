import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { render, screen } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { type VariableSpec } from 'app/api/clients/dashboard/v2beta1';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder } from 'app/features/apiserver/types';

import BrowseFolderVariablesPage from './BrowseFolderVariablesPage';
import * as permissions from './permissions';

const GLOBAL_DASHBOARD_VARIABLES_FLAG = 'grafana.dashboardGlobalVariables';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn(),
  useNavigate: jest.fn(() => jest.fn()),
}));

const [_, { folderA }] = getFolderFixtures();
const mockFolderName = folderA.item.title;
const mockFolderUid = folderA.item.uid;

const folderVariable = {
  metadata: {
    name: `env--${mockFolderUid}`,
    annotations: { [AnnoKeyFolder]: mockFolderUid },
  },
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  spec: {
    kind: 'CustomVariable',
    spec: { name: 'env', query: 'dev,prod' },
  } as unknown as VariableSpec,
};

describe('browse-dashboards BrowseFolderVariablesPage', () => {
  (useParams as jest.Mock).mockReturnValue({ uid: mockFolderUid });
  const mockPermissions = {
    canCreateDashboards: true,
    canEditDashboards: true,
    canCreateFolders: true,
    canDeleteFolders: true,
    canEditFolders: true,
    canViewPermissions: true,
    canSetPermissions: true,
    canDeleteDashboards: true,
  };

  beforeEach(() => {
    config.unifiedAlertingEnabled = true;
    setTestFlags({ [GLOBAL_DASHBOARD_VARIABLES_FLAG]: true });
    server.use(
      http.get('/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/variables', () => {
        return HttpResponse.json({
          kind: 'VariableList',
          apiVersion: 'dashboard.grafana.app/v2beta1',
          metadata: {},
          items: [folderVariable],
        });
      })
    );

    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted (RTL cleanup runs in a separate afterEach).
    await act(async () => {
      setTestFlags({});
    });
  });

  it('displays the folder title', async () => {
    render(<BrowseFolderVariablesPage />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
  });

  it('displays the "Folder actions" button', async () => {
    render(<BrowseFolderVariablesPage />);
    expect(await screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
  });

  it('does not display the "Folder actions" button if the user does not have permissions', async () => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => {
      return {
        ...mockPermissions,
        canDeleteFolders: false,
        canEditFolders: false,
        canViewPermissions: false,
        canSetPermissions: false,
      };
    });
    render(<BrowseFolderVariablesPage />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });

  it('displays all the folder tabs and shows the "Variables" tab as selected', async () => {
    render(<BrowseFolderVariablesPage />);
    expect(await screen.findByRole('tab', { name: 'Dashboards' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Dashboards' })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: /^Panels/ })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^Panels/ })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: /^Alert rules/ })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^Alert rules/ })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: 'Variables' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Variables' })).toHaveAttribute('aria-selected', 'true');
  });

  it('displays folder-scoped variables returned by the API', async () => {
    render(<BrowseFolderVariablesPage />);

    expect(await screen.findByText('env')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'New folder variable' })).toBeEnabled();
  });

  it('disables "New folder variable" when the user cannot edit the folder', async () => {
    server.use(
      http.get('/api/folders/:uid', () => {
        return HttpResponse.json({
          id: 1,
          uid: mockFolderUid,
          title: mockFolderName,
          canEdit: false,
          canSave: false,
          canAdmin: false,
          canDelete: false,
        });
      })
    );
    render(<BrowseFolderVariablesPage />);

    expect(await screen.findByRole('button', { name: 'New folder variable' })).toBeDisabled();
  });

  it('displays an empty state when the folder has no variables', async () => {
    server.use(
      http.get('/apis/dashboard.grafana.app/v2beta1/namespaces/:namespace/variables', () => {
        return HttpResponse.json({
          kind: 'VariableList',
          apiVersion: 'dashboard.grafana.app/v2beta1',
          metadata: {},
          items: [],
        });
      })
    );
    render(<BrowseFolderVariablesPage />);

    expect(await screen.findByText('No folder-scoped variables in this folder yet.')).toBeInTheDocument();
  });
});
