import { render as rtlRender, screen } from '@testing-library/react';
import { Chance } from 'chance';
import { http, HttpResponse } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import { useParams } from 'react-router-dom-v5-compat';
import { TestProvider } from 'test/helpers/TestProvider';

import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

import BrowseFolderAlertingPage from './BrowseFolderAlertingPage';
import { getPrometheusRulesResponse, getRulerRulesResponse } from './fixtures/alertRules.fixture';
import * as permissions from './permissions';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    unifiedAlertingEnabled: true,
  },
}));
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn(),
}));
const mockFolderName = 'myFolder';
const mockFolderUid = '12345';

const random = Chance(1);
const rule_uid = random.guid();
const mockRulerRulesResponse = getRulerRulesResponse(mockFolderName, mockFolderUid, rule_uid);
const mockPrometheusRulesResponse = getPrometheusRulesResponse(mockFolderName, mockFolderUid, rule_uid);

describe('browse-dashboards BrowseFolderAlertingPage', () => {
  (useParams as jest.Mock).mockReturnValue({ uid: mockFolderUid });
  let server: SetupServer;
  const mockPermissions = {
    canCreateDashboards: true,
    canEditDashboards: true,
    canCreateFolders: true,
    canDeleteFolders: true,
    canEditFolders: true,
    canViewPermissions: true,
    canSetPermissions: true,
  };

  beforeAll(() => {
    server = setupServer(
      http.get('/api/folders/:uid', () => {
        return HttpResponse.json({
          title: mockFolderName,
          uid: mockFolderUid,
        });
      }),
      http.get('api/ruler/grafana/api/v1/rules', () => {
        return HttpResponse.json(mockRulerRulesResponse);
      }),
      http.get('api/prometheus/grafana/api/v1/rules', () => {
        return HttpResponse.json(mockPrometheusRulesResponse);
      })
    );
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    server.resetHandlers();
  });

  it('displays the folder title', async () => {
    render(<BrowseFolderAlertingPage />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
  });

  it('displays the "Folder actions" button', async () => {
    render(<BrowseFolderAlertingPage />);
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
    render(<BrowseFolderAlertingPage />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Folder actions' })).not.toBeInTheDocument();
  });

  it('displays all the folder tabs and shows the "Alert rules" tab as selected', async () => {
    render(<BrowseFolderAlertingPage />);
    expect(await screen.findByRole('tab', { name: 'Dashboards' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Dashboards' })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: 'Panels' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Panels' })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: 'Alert rules' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Alert rules' })).toHaveAttribute('aria-selected', 'true');
  });

  it('displays the alert rules returned by the API', async () => {
    render(<BrowseFolderAlertingPage />);

    const ruleName = mockPrometheusRulesResponse.data.groups[0].rules[0].name;
    expect(await screen.findByRole('link', { name: ruleName })).toBeInTheDocument();
  });
});
