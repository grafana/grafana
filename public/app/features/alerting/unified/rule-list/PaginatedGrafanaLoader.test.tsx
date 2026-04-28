import { render, screen, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { useAssistant } from '@grafana/assistant';
import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';
import {
  type GrafanaPromRecordingRuleDTO,
  type GrafanaPromRuleGroupDTO,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

import { mockFolderApi, setupMswServer } from '../mockApi';
import { grantUserPermissions, mockFolder, mockGrafanaPromAlertingRule } from '../mocks';
import { NO_GROUP_PREFIX } from '../utils/rules';

import { GrafanaRuleGroupListItem } from './PaginatedGrafanaLoader';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type, data) => ({ type, ...data })),
}));
jest.mocked(useAssistant).mockReturnValue({
  isLoading: false,
  isAvailable: false,
  openAssistant: jest.fn(),
  closeAssistant: jest.fn(),
  toggleAssistant: jest.fn(),
});

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

const server = setupMswServer();

const ui = {
  treeItem: byRole('treeitem'),
  groupLink: (name: string | RegExp) => byRole('link', { name }),
  ruleLink: (name: string | RegExp) => byRole('link', { name }),
};

describe('GrafanaRuleGroupListItem', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    mockFolderApi(server).folder('folder-123', mockFolder({ uid: 'folder-123', title: 'TestFolder' }));
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('should render an ungrouped alerting rule directly without a group wrapper', async () => {
    const grafanaRule = mockGrafanaPromAlertingRule({ name: 'My Alert Rule' });
    const ungroupedGroup: GrafanaPromRuleGroupDTO = {
      name: `${NO_GROUP_PREFIX}test-rule-uid`,
      file: 'TestFolder',
      folderUid: 'folder-123',
      interval: 60,
      rules: [grafanaRule],
    };

    render(<GrafanaRuleGroupListItem group={ungroupedGroup} namespaceName="TestFolder" />);

    const treeItem = await ui.treeItem.find();
    expect(within(treeItem).getByRole('link', { name: 'My Alert Rule' })).toBeInTheDocument();
    // No "(Ungrouped)" suffix — wrapper is gone, so rule name renders verbatim.
    expect(screen.queryByText(/Ungrouped/)).not.toBeInTheDocument();
    // No ListGroup wrapper => no aria-expanded toggle on the treeitem.
    expect(treeItem).not.toHaveAttribute('aria-expanded');
  });

  it('should render an ungrouped recording rule directly', async () => {
    const recordingRule: GrafanaPromRecordingRuleDTO = {
      type: PromRuleType.Recording,
      name: 'My Recording Rule',
      query: 'count(up)',
      health: 'ok',
      uid: 'rec-rule-uid',
      folderUid: 'folder-123',
      isPaused: false,
    };
    const ungroupedGroup: GrafanaPromRuleGroupDTO = {
      name: `${NO_GROUP_PREFIX}rec-rule-uid`,
      file: 'TestFolder',
      folderUid: 'folder-123',
      interval: 60,
      rules: [recordingRule],
    };

    render(<GrafanaRuleGroupListItem group={ungroupedGroup} namespaceName="TestFolder" />);

    const treeItem = await ui.treeItem.find();
    expect(within(treeItem).getByRole('link', { name: 'My Recording Rule' })).toBeInTheDocument();
    expect(treeItem).not.toHaveAttribute('aria-expanded');
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
