import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { rulerTestDb } from '../alerting/unified/mocks/grafanaRulerApi';
import { alertingFactory } from '../alerting/unified/mocks/server/db';
import { DEFAULT_FOLDERS } from '../alerting/unified/mocks/server/handlers/folders';

import BrowseFolderAlertingPage from './BrowseFolderAlertingPage';
import * as permissions from './permissions';

// Use the folder and rules from the mocks
const folder = DEFAULT_FOLDERS[0];
const { uid: folderUid, title: folderTitle } = folder;

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn(() => ({ uid: folderUid })),
}));

config.unifiedAlertingEnabled = true;

setupMswServer();

describe('browse-dashboards BrowseFolderAlertingPage', () => {
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
    jest.spyOn(permissions, 'getFolderPermissions').mockImplementation(() => mockPermissions);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('displays the folder title', async () => {
    render(<BrowseFolderAlertingPage />);
    expect(await screen.findByRole('heading', { name: folderTitle })).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', { name: folderTitle })).toBeInTheDocument();
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

  it('displays rules from the folder', async () => {
    const ruleUid = 'xYz1A2b3C4';

    const group = alertingFactory.ruler.grafana.group.build({
      name: 'test-group',
      rules: [
        alertingFactory.ruler.grafana.alertingRule.build({
          grafana_alert: { title: 'Grafana-rule', namespace_uid: folderUid, rule_group: 'test-group', uid: ruleUid },
        }),
      ],
    });
    rulerTestDb.addGroup(group, { name: folderTitle, uid: folderUid });
    render(<BrowseFolderAlertingPage />);

    expect(await screen.findByRole('heading', { name: folderTitle })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Grafana-rule' })).toHaveAttribute(
      'href',
      `/alerting/grafana/${ruleUid}/view`
    );
  });
});
