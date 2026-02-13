import { render, screen } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { mockFolderApi, setupMswServer } from '../mockApi';
import { grantUserPermissions, mockFolder, mockGrafanaPromAlertingRule } from '../mocks';
import { NO_GROUP_PREFIX } from '../utils/rules';

import { GrafanaRuleGroupListItem } from './PaginatedGrafanaLoader';

const server = setupMswServer();

const ui = {
  treeItem: byRole('treeitem'),
  groupLink: (name: string | RegExp) => byRole('link', { name }),
  ungroupedText: byText(/\(Ungrouped\)/),
};

describe('GrafanaRuleGroupListItem', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    mockFolderApi(server).folder('folder-123', mockFolder({ uid: 'folder-123', title: 'TestFolder' }));
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('should display rule name with (Ungrouped) suffix for ungrouped rules', async () => {
    const grafanaRule = mockGrafanaPromAlertingRule({ name: 'My Alert Rule' });
    const ungroupedGroup: GrafanaPromRuleGroupDTO = {
      name: `${NO_GROUP_PREFIX}test-rule-uid`,
      file: 'TestFolder',
      folderUid: 'folder-123',
      interval: 60,
      rules: [grafanaRule],
    };

    render(<GrafanaRuleGroupListItem group={ungroupedGroup} namespaceName="TestFolder" />);

    expect(await ui.treeItem.find()).toBeInTheDocument();
    expect(await ui.groupLink(/My Alert Rule \(Ungrouped\)/).find()).toBeInTheDocument();
  });

  it('should display normal group name for grouped rules', async () => {
    const grafanaRule = mockGrafanaPromAlertingRule({ name: 'My Alert Rule' });
    const groupedGroup: GrafanaPromRuleGroupDTO = {
      name: 'MyGroup',
      file: 'TestFolder',
      folderUid: 'folder-123',
      interval: 60,
      rules: [grafanaRule],
    };

    render(<GrafanaRuleGroupListItem group={groupedGroup} namespaceName="TestFolder" />);

    expect(await ui.groupLink('MyGroup').find()).toBeInTheDocument();
    expect(screen.queryByText(/Ungrouped/)).not.toBeInTheDocument();
  });

  it('should render link to group details page with correct URL', async () => {
    const grafanaRule = mockGrafanaPromAlertingRule({ name: 'My Alert Rule' });
    const groupedGroup: GrafanaPromRuleGroupDTO = {
      name: 'MyGroup',
      file: 'TestFolder',
      folderUid: 'folder-123',
      interval: 60,
      rules: [grafanaRule],
    };

    render(<GrafanaRuleGroupListItem group={groupedGroup} namespaceName="TestFolder" />);

    const link = await ui.groupLink('MyGroup').find();
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/alerting/grafana/namespaces/folder-123/groups/MyGroup/view')
    );
  });

  it('should render as treeitem with correct aria attributes', async () => {
    const grafanaRule = mockGrafanaPromAlertingRule({ name: 'My Alert Rule' });
    const group: GrafanaPromRuleGroupDTO = {
      name: 'TestGroup',
      file: 'TestFolder',
      folderUid: 'folder-123',
      interval: 60,
      rules: [grafanaRule],
    };

    render(<GrafanaRuleGroupListItem group={group} namespaceName="TestFolder" />);

    const treeItem = await ui.treeItem.find();
    expect(treeItem).toHaveAttribute('aria-expanded', 'false');
    expect(treeItem).toHaveAttribute('aria-selected', 'false');
  });
});
