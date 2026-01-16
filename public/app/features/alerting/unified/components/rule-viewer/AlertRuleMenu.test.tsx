import { render, screen, testWithFeatureToggles, userEvent, waitFor } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { useAssistant } from '@grafana/assistant';
import { GrafanaEdition } from '@grafana/data/internal';
import { config, setPluginLinksHook } from '@grafana/runtime';
import AlertRuleMenu from 'app/features/alerting/unified/components/rule-viewer/AlertRuleMenu';
import { mockFolderApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import {
  getCloudRule,
  getGrafanaRule,
  grantUserPermissions,
  mockDataSource,
  mockFolder,
  mockGrafanaRulerRule,
  mockPromAlertingRule,
  mockPromRecordingRule,
  mockRulerGrafanaRecordingRule,
} from 'app/features/alerting/unified/mocks';
import { setFolderAccessControl } from 'app/features/alerting/unified/mocks/server/configure';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import * as miscUtils from 'app/features/alerting/unified/utils/misc';
import { fromCombinedRule } from 'app/features/alerting/unified/utils/rule-id';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { AlertRuleAction } from '../../hooks/useAbilities';

const mockOpenAssistant = jest.fn();
jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  createAssistantContextItem: jest.fn(<T extends object>(type: string, data: T) => ({
    type,
    ...data,
  })),
}));

const mockUseAssistant = jest.mocked(useAssistant);

const mockPauseExecute = jest.fn().mockResolvedValue(undefined);
jest.mock('../../hooks/ruleGroup/usePauseAlertRule', () => ({
  usePauseRuleInGroup: () => [
    {
      execute: mockPauseExecute,
    },
    { loading: false, error: undefined },
  ],
}));

const server = setupMswServer();

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));

setupDataSources();

const user = userEvent.setup();
const handleSilence = jest.fn();
const handleDelete = jest.fn();
const handleDuplicateRule = jest.fn();

const ui = {
  moreButton: byLabelText(/More/),
  menu: byRole('menu'),
  menuItems: {
    pause: byRole('menuitem', { name: /Pause evaluation/i }),
    resume: byRole('menuitem', { name: /Resume evaluation/i }),
    silence: byRole('menuitem', { name: /Silence notifications/i }),
    duplicate: byRole('menuitem', { name: /Duplicate/i }),
    copyLink: byRole('menuitem', { name: /Copy link/i }),
    export: byRole('menuitem', { name: /Export/i }),
    delete: byRole('menuitem', { name: /Delete/i }),
    manageEnrichments: byRole('menuitem', { name: /Manage enrichments/i }),
    declareIncident: byRole('link', { name: /Declare incident/i }),
    analyzeRule: byRole('menuitem', { name: /Analyze rule/i }),
  },
};

const getMenuContents = async () => {
  await screen.findByRole('menu');
  const allMenuItems = screen.queryAllByRole('menuitem').map((el) => el.textContent);
  const allLinkItems = screen.queryAllByRole('link').map((el) => el.textContent);

  return [...allMenuItems, ...allLinkItems];
};

const openMenu = async () => {
  await user.click(await ui.moreButton.find());
  await waitFor(() => {
    expect(ui.menu.query()).toBeInTheDocument();
  });
};

// Helper function to create a default rule setup
const createDefaultRuleSetup = () => {
  const mockRule = getGrafanaRule();
  const identifier = fromCombinedRule('grafana', mockRule);
  const groupIdentifier = {
    groupOrigin: 'grafana' as const,
    namespace: { uid: 'namespace-uid' },
    groupName: 'group-name',
  };

  return { mockRule, identifier, groupIdentifier };
};

describe('AlertRuleMenu', () => {
  const originalBuildInfo = config.buildInfo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPauseExecute.mockResolvedValue(undefined);
    mockOpenAssistant.mockClear();
    // Default: assistant unavailable
    mockUseAssistant.mockReturnValue({
      isAvailable: false,
      openAssistant: mockOpenAssistant,
    } as unknown as ReturnType<typeof useAssistant>);

    // Reset config to defaults
    config.buildInfo = { ...originalBuildInfo };

    // Set up default folder mock for Grafana rules (namespace-uid is the default folder UID)
    mockFolderApi(server).folder('namespace-uid', mockFolder({ uid: 'namespace-uid', title: 'Test Folder' }));

    // Set up default permissions (no permissions granted by default)
    grantUserPermissions([]);
    setFolderAccessControl({});
  });

  afterEach(() => {
    config.buildInfo = originalBuildInfo;
  });

  describe('Basic Rendering', () => {
    it('renders MoreButton correctly', async () => {
      const mockRule = getGrafanaRule();
      const identifier = fromCombinedRule('grafana', mockRule);
      const groupIdentifier = {
        groupOrigin: 'grafana' as const,
        namespace: { uid: 'namespace-uid' },
        groupName: 'group-name',
      };

      render(
        <AlertRuleMenu
          promRule={mockRule.promRule}
          rulerRule={mockRule.rulerRule}
          identifier={identifier}
          groupIdentifier={groupIdentifier}
          handleSilence={handleSilence}
          handleDelete={handleDelete}
          handleDuplicateRule={handleDuplicateRule}
        />
      );

      expect(await ui.moreButton.find()).toBeInTheDocument();
    });

    it('opens menu when MoreButton is clicked', async () => {
      const mockRule = getGrafanaRule();
      const identifier = fromCombinedRule('grafana', mockRule);
      const groupIdentifier = {
        groupOrigin: 'grafana' as const,
        namespace: { uid: 'namespace-uid' },
        groupName: 'group-name',
      };

      render(
        <AlertRuleMenu
          promRule={mockRule.promRule}
          rulerRule={mockRule.rulerRule}
          identifier={identifier}
          groupIdentifier={groupIdentifier}
          handleSilence={handleSilence}
          handleDelete={handleDelete}
          handleDuplicateRule={handleDuplicateRule}
        />
      );

      await openMenu();

      expect(ui.menu.query()).toBeInTheDocument();
    });

    it('closes menu when clicking outside', async () => {
      const mockRule = getGrafanaRule();
      const identifier = fromCombinedRule('grafana', mockRule);
      const groupIdentifier = {
        groupOrigin: 'grafana' as const,
        namespace: { uid: 'namespace-uid' },
        groupName: 'group-name',
      };

      render(
        <AlertRuleMenu
          promRule={mockRule.promRule}
          rulerRule={mockRule.rulerRule}
          identifier={identifier}
          groupIdentifier={groupIdentifier}
          handleSilence={handleSilence}
          handleDelete={handleDelete}
          handleDuplicateRule={handleDuplicateRule}
        />
      );

      await openMenu();
      expect(ui.menu.query()).toBeInTheDocument();

      // Click outside the menu
      await user.click(document.body);

      await waitFor(() => {
        expect(ui.menu.query()).not.toBeInTheDocument();
      });
    });

    it('menu contains expected structure', async () => {
      const mockRule = getGrafanaRule({
        promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }),
      });
      const identifier = fromCombinedRule('grafana', mockRule);
      const groupIdentifier = {
        groupOrigin: 'grafana' as const,
        namespace: { uid: 'namespace-uid' },
        groupName: 'group-name',
      };

      render(
        <AlertRuleMenu
          promRule={mockRule.promRule}
          rulerRule={mockRule.rulerRule}
          identifier={identifier}
          groupIdentifier={groupIdentifier}
          handleSilence={handleSilence}
          handleDelete={handleDelete}
          handleDuplicateRule={handleDuplicateRule}
        />
      );

      await openMenu();

      const menuContents = await getMenuContents();
      expect(menuContents).toHaveLength(1);
      expect(menuContents).toContain('Copy link');
    });
  });

  describe('Permissions', () => {
    // Generalized test to reduce repetition for menu item visibility
    type MenuItemTestCase = {
      description: string;
      action: AlertRuleAction;
      menuItem: keyof typeof ui.menuItems;
      granted: boolean;
      shouldShow: boolean;
    };

    const testMenuItemVisibility = ({ description, action, menuItem, granted, shouldShow }: MenuItemTestCase) => {
      it(description, async () => {
        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        // Grant permissions based on action
        const permissions: AccessControlAction[] = [];
        const folderAccessControl: Record<string, boolean> = {};

        if (granted) {
          switch (action) {
            case AlertRuleAction.Pause:
            case AlertRuleAction.Update:
              permissions.push(AccessControlAction.AlertingRuleUpdate);
              folderAccessControl[AccessControlAction.AlertingRuleUpdate] = true;
              break;
            case AlertRuleAction.Delete:
              permissions.push(AccessControlAction.AlertingRuleDelete);
              folderAccessControl[AccessControlAction.AlertingRuleDelete] = true;
              break;
            case AlertRuleAction.Duplicate:
              permissions.push(AccessControlAction.AlertingRuleCreate);
              break;
            case AlertRuleAction.Silence:
              permissions.push(AccessControlAction.AlertingInstanceCreate, AccessControlAction.AlertingSilenceCreate);
              break;
            case AlertRuleAction.ModifyExport:
              permissions.push(AccessControlAction.AlertingRuleRead);
              break;
          }
        }

        grantUserPermissions(permissions);
        setFolderAccessControl(folderAccessControl);

        // Set up folder mock for Grafana rules with matching access control
        mockFolderApi(server).folder(
          'namespace-uid',
          mockFolder({
            uid: 'namespace-uid',
            title: 'Test Folder',
            accessControl: folderAccessControl,
          })
        );

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        if (shouldShow) {
          expect(await ui.menuItems[menuItem].find()).toBeInTheDocument();
        } else {
          expect(ui.menuItems[menuItem].query()).not.toBeInTheDocument();
        }
      });
    };

    describe('Pause/Resume visibility', () => {
      testMenuItemVisibility({
        description: 'shows Pause when pause permission is granted',
        action: AlertRuleAction.Pause,
        menuItem: 'pause',
        granted: true,
        shouldShow: true,
      });

      testMenuItemVisibility({
        description: 'hides Pause when pause permission is denied',
        action: AlertRuleAction.Pause,
        menuItem: 'pause',
        granted: false,
        shouldShow: false,
      });
    });

    describe('Delete visibility', () => {
      testMenuItemVisibility({
        description: 'shows Delete when delete permission is granted',
        action: AlertRuleAction.Delete,
        menuItem: 'delete',
        granted: true,
        shouldShow: true,
      });

      testMenuItemVisibility({
        description: 'hides Delete when delete permission is denied',
        action: AlertRuleAction.Delete,
        menuItem: 'delete',
        granted: false,
        shouldShow: false,
      });
    });

    describe('Duplicate visibility', () => {
      testMenuItemVisibility({
        description: 'shows Duplicate when duplicate permission is granted',
        action: AlertRuleAction.Duplicate,
        menuItem: 'duplicate',
        granted: true,
        shouldShow: true,
      });

      testMenuItemVisibility({
        description: 'hides Duplicate when duplicate permission is denied',
        action: AlertRuleAction.Duplicate,
        menuItem: 'duplicate',
        granted: false,
        shouldShow: false,
      });
    });

    describe('Silence visibility', () => {
      testMenuItemVisibility({
        description: 'shows Silence when silence permission is granted',
        action: AlertRuleAction.Silence,
        menuItem: 'silence',
        granted: true,
        shouldShow: true,
      });

      testMenuItemVisibility({
        description: 'hides Silence when silence permission is denied',
        action: AlertRuleAction.Silence,
        menuItem: 'silence',
        granted: false,
        shouldShow: false,
      });
    });

    describe('Export visibility', () => {
      testMenuItemVisibility({
        description: 'shows Export when export permission is granted',
        action: AlertRuleAction.ModifyExport,
        menuItem: 'export',
        granted: true,
        shouldShow: true,
      });

      testMenuItemVisibility({
        description: 'hides Export when export permission is denied',
        action: AlertRuleAction.ModifyExport,
        menuItem: 'export',
        granted: false,
        shouldShow: false,
      });
    });

    describe('Copy Link visibility', () => {
      it('shows Copy Link when shareUrl exists', async () => {
        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(await ui.menuItems.copyLink.find()).toBeInTheDocument();
      });
    });
  });

  describe('Rule Types', () => {
    beforeEach(() => {
      // Grant all permissions for testing rule type differences
      grantUserPermissions([
        AccessControlAction.AlertingRuleRead,
        AccessControlAction.AlertingRuleUpdate,
        AccessControlAction.AlertingRuleDelete,
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingInstanceCreate,
        AccessControlAction.AlertingSilenceCreate,
      ]);
      setFolderAccessControl({
        [AccessControlAction.AlertingRuleUpdate]: true,
        [AccessControlAction.AlertingRuleDelete]: true,
      });
      mockFolderApi(server).folder(
        'namespace-uid',
        mockFolder({
          uid: 'namespace-uid',
          title: 'Test Folder',
          accessControl: {
            [AccessControlAction.AlertingRuleUpdate]: true,
            [AccessControlAction.AlertingRuleDelete]: true,
          },
        })
      );
    });

    describe('Grafana-managed rules', () => {
      it('shows Pause option for Grafana-managed alerting rules', async () => {
        const mockRule = getGrafanaRule();
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(await ui.menuItems.pause.find()).toBeInTheDocument();
      });

      it('does not show Pause option for datasource-managed rules', async () => {
        const datasource = mockDataSource({ uid: 'mimir', name: 'Mimir' });
        const mockRule = getCloudRule({}, { rulesSource: datasource });
        const identifier = fromCombinedRule(datasource.name, mockRule);
        const groupIdentifier = {
          groupOrigin: 'datasource' as const,
          rulesSource: { uid: datasource.uid, name: datasource.name, ruleSourceType: 'datasource' as const },
          namespace: { name: 'namespace-name' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.pause.query()).not.toBeInTheDocument();
      });
    });

    describe('Alerting vs Recording rules', () => {
      it('shows Silence option for alerting rules', async () => {
        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ type: PromRuleType.Alerting }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(await ui.menuItems.silence.find()).toBeInTheDocument();
      });

      it('does not show Silence option for recording rules', async () => {
        const mockRule = getGrafanaRule({
          promRule: mockPromRecordingRule({ type: PromRuleType.Recording }),
        });
        // Override the rulerRule to be a recording rule
        mockRule.rulerRule = mockRulerGrafanaRecordingRule(
          {},
          {
            uid: 'mock-rule-uid-123',
            namespace_uid: 'namespace-uid',
          }
        );
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        mockFolderApi(server).folder(
          'namespace-uid',
          mockFolder({
            uid: 'namespace-uid',
            title: 'Test Folder',
          })
        );

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.silence.query()).not.toBeInTheDocument();
      });
    });

    describe('Provisioned rules', () => {
      it('hides Delete option for provisioned rules', async () => {
        const mockRule = getGrafanaRule({
          rulerRule: mockGrafanaRulerRule({ provenance: 'file' }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.delete.query()).not.toBeInTheDocument();
      });

      it('hides Pause option for provisioned rules', async () => {
        const mockRule = getGrafanaRule({
          rulerRule: mockGrafanaRulerRule({ provenance: 'file' }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.pause.query()).not.toBeInTheDocument();
      });
    });

    describe('Mixed data scenarios', () => {
      it('works with only promRule available', async () => {
        const mockRule = getGrafanaRule();
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={undefined}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menu.query()).toBeInTheDocument();
      });

      it('works with only rulerRule available', async () => {
        const mockRule = getGrafanaRule();
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={undefined}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menu.query()).toBeInTheDocument();
      });

      it('works with both promRule and rulerRule available', async () => {
        const mockRule = getGrafanaRule();
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menu.query()).toBeInTheDocument();
      });
    });
  });

  describe('Handler Callbacks', () => {
    describe('handleSilence', () => {
      it('calls handleSilence when Silence menu item is clicked', async () => {
        grantUserPermissions([AccessControlAction.AlertingInstanceCreate, AccessControlAction.AlertingSilenceCreate]);
        mockFolderApi(server).folder('namespace-uid', mockFolder({ uid: 'namespace-uid', title: 'Test Folder' }));

        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        await user.click(await ui.menuItems.silence.find());

        expect(handleSilence).toHaveBeenCalledTimes(1);
      });
    });

    describe('handleManageEnrichments', () => {
      testWithFeatureToggles({
        enable: ['alertEnrichment', 'alertingEnrichmentPerRule'],
      });

      it('calls handleManageEnrichments when Manage enrichments menu item is clicked', async () => {
        // Both toggles need to be enabled: alertEnrichment for the hook, alertingEnrichmentPerRule for the component
        grantUserPermissions([AccessControlAction.AlertingEnrichmentsRead]);
        mockFolderApi(server).folder('namespace-uid', mockFolder({ uid: 'namespace-uid', title: 'Test Folder' }));

        const handleManageEnrichments = jest.fn();
        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
            handleManageEnrichments={handleManageEnrichments}
          />
        );

        await openMenu();
        await user.click(await ui.menuItems.manageEnrichments.find());

        expect(handleManageEnrichments).toHaveBeenCalledTimes(1);
      });
    });

    describe('handleDelete', () => {
      it('calls handleDelete with correct identifier and groupIdentifier when Delete menu item is clicked', async () => {
        grantUserPermissions([AccessControlAction.AlertingRuleDelete]);
        setFolderAccessControl({ [AccessControlAction.AlertingRuleDelete]: true });
        mockFolderApi(server).folder(
          'namespace-uid',
          mockFolder({
            uid: 'namespace-uid',
            title: 'Test Folder',
            accessControl: { [AccessControlAction.AlertingRuleDelete]: true },
          })
        );

        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        await user.click(await ui.menuItems.delete.find());

        expect(handleDelete).toHaveBeenCalledTimes(1);
        expect(handleDelete).toHaveBeenCalledWith(identifier, groupIdentifier);
      });

      it('does not call handleDelete when identifier is not editable', async () => {
        grantUserPermissions([AccessControlAction.AlertingRuleDelete]);
        setFolderAccessControl({ [AccessControlAction.AlertingRuleDelete]: true });
        mockFolderApi(server).folder(
          'namespace-uid',
          mockFolder({
            uid: 'namespace-uid',
            title: 'Test Folder',
            accessControl: { [AccessControlAction.AlertingRuleDelete]: true },
          })
        );

        const { mockRule, groupIdentifier } = createDefaultRuleSetup();
        // Create a non-editable identifier (e.g., Prometheus rule identifier without rulerRule)
        // For external rules without rulerRule, the delete button should not appear
        const identifier = fromCombinedRule('prometheus', {
          ...mockRule,
          rulerRule: undefined,
        });

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={undefined}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.delete.query()).not.toBeInTheDocument();
        expect(handleDelete).not.toHaveBeenCalled();
      });
    });

    describe('handleDuplicateRule', () => {
      it('calls handleDuplicateRule with correct identifier when Duplicate menu item is clicked', async () => {
        grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
        mockFolderApi(server).folder('namespace-uid', mockFolder({ uid: 'namespace-uid', title: 'Test Folder' }));

        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        await user.click(await ui.menuItems.duplicate.find());

        expect(handleDuplicateRule).toHaveBeenCalledTimes(1);
        expect(handleDuplicateRule).toHaveBeenCalledWith(identifier);
      });
    });

    describe('onPauseChange', () => {
      it('calls onPauseChange after pause state change when Pause menu item is clicked', async () => {
        const onPauseChange = jest.fn();
        grantUserPermissions([AccessControlAction.AlertingRuleUpdate]);
        setFolderAccessControl({ [AccessControlAction.AlertingRuleUpdate]: true });
        mockFolderApi(server).folder(
          'namespace-uid',
          mockFolder({
            uid: 'namespace-uid',
            title: 'Test Folder',
            accessControl: { [AccessControlAction.AlertingRuleUpdate]: true },
          })
        );

        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
            onPauseChange={onPauseChange}
          />
        );

        await openMenu();
        await user.click(await ui.menuItems.pause.find());

        await waitFor(() => {
          expect(mockPauseExecute).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
          expect(onPauseChange).toHaveBeenCalledTimes(1);
        });
        expect(onPauseChange).toHaveBeenCalledWith();
      });

      it('calls onPauseChange after resume state change when Resume menu item is clicked', async () => {
        const onPauseChange = jest.fn();
        grantUserPermissions([AccessControlAction.AlertingRuleUpdate]);
        setFolderAccessControl({ [AccessControlAction.AlertingRuleUpdate]: true });
        mockFolderApi(server).folder(
          'namespace-uid',
          mockFolder({
            uid: 'namespace-uid',
            title: 'Test Folder',
            accessControl: { [AccessControlAction.AlertingRuleUpdate]: true },
          })
        );

        const mockRule = getGrafanaRule({
          rulerRule: mockGrafanaRulerRule({ is_paused: true }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
            onPauseChange={onPauseChange}
          />
        );

        await openMenu();
        await user.click(await ui.menuItems.resume.find());

        await waitFor(() => {
          expect(mockPauseExecute).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
          expect(onPauseChange).toHaveBeenCalledTimes(1);
        });
        expect(onPauseChange).toHaveBeenCalledWith();
      });
    });
  });

  describe('Feature Flags', () => {
    describe('alertingEnrichmentPerRule', () => {
      describe('when feature flag is disabled', () => {
        testWithFeatureToggles({
          disable: ['alertingEnrichmentPerRule'],
        });

        it('hides Manage enrichments when feature flag is disabled', async () => {
          grantUserPermissions([AccessControlAction.AlertingEnrichmentsRead]);

          const handleManageEnrichments = jest.fn();
          const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

          render(
            <AlertRuleMenu
              promRule={mockRule.promRule}
              rulerRule={mockRule.rulerRule}
              identifier={identifier}
              groupIdentifier={groupIdentifier}
              handleSilence={handleSilence}
              handleDelete={handleDelete}
              handleDuplicateRule={handleDuplicateRule}
              handleManageEnrichments={handleManageEnrichments}
            />
          );

          await openMenu();
          expect(ui.menuItems.manageEnrichments.query()).not.toBeInTheDocument();
        });
      });

      describe('when feature flag is enabled', () => {
        testWithFeatureToggles({
          enable: ['alertEnrichment', 'alertingEnrichmentPerRule'],
        });

        it('shows Manage enrichments when feature flag is enabled and all conditions are met', async () => {
          // Both toggles need to be enabled: alertEnrichment for the hook, alertingEnrichmentPerRule for the component
          grantUserPermissions([AccessControlAction.AlertingEnrichmentsRead]);
          mockFolderApi(server).folder('namespace-uid', mockFolder({ uid: 'namespace-uid', title: 'Test Folder' }));

          const handleManageEnrichments = jest.fn();
          const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

          render(
            <AlertRuleMenu
              promRule={mockRule.promRule}
              rulerRule={mockRule.rulerRule}
              identifier={identifier}
              groupIdentifier={groupIdentifier}
              handleSilence={handleSilence}
              handleDelete={handleDelete}
              handleDuplicateRule={handleDuplicateRule}
              handleManageEnrichments={handleManageEnrichments}
            />
          );

          await openMenu();
          expect(await ui.menuItems.manageEnrichments.find()).toBeInTheDocument();
        });
      });

      describe('when feature flags are enabled but permission is missing', () => {
        testWithFeatureToggles({
          enable: ['alertEnrichment', 'alertingEnrichmentPerRule'],
        });

        it('hides Manage enrichments when enrichment ability is not allowed', async () => {
          // Enable both toggles to ensure we're testing the permission check, not the toggles
          grantUserPermissions([]);
          mockFolderApi(server).folder('namespace-uid', mockFolder({ uid: 'namespace-uid', title: 'Test Folder' }));

          const handleManageEnrichments = jest.fn();
          const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

          render(
            <AlertRuleMenu
              promRule={mockRule.promRule}
              rulerRule={mockRule.rulerRule}
              identifier={identifier}
              groupIdentifier={groupIdentifier}
              handleSilence={handleSilence}
              handleDelete={handleDelete}
              handleDuplicateRule={handleDuplicateRule}
              handleManageEnrichments={handleManageEnrichments}
            />
          );

          await openMenu();
          expect(ui.menuItems.manageEnrichments.query()).not.toBeInTheDocument();
        });
      });
    });

    describe('Open-source vs Enterprise', () => {
      it('hides Declare Incident in open-source edition for firing alerting rules', async () => {
        config.buildInfo.edition = GrafanaEdition.OpenSource;
        config.buildInfo.env = 'production';

        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Firing }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.declareIncident.query()).not.toBeInTheDocument();
      });

      it('shows Declare Incident in enterprise edition for firing alerting rules', async () => {
        config.buildInfo.edition = GrafanaEdition.Enterprise;
        config.buildInfo.env = 'production';

        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Firing }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(await ui.menuItems.declareIncident.find()).toBeInTheDocument();
      });

      it('shows Declare Incident in dev mode even for open-source edition', async () => {
        config.buildInfo.edition = GrafanaEdition.OpenSource;
        config.buildInfo.env = 'development';

        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Firing }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(await ui.menuItems.declareIncident.find()).toBeInTheDocument();
      });

      it('hides Declare Incident for non-firing alerting rules in enterprise', async () => {
        config.buildInfo.edition = GrafanaEdition.Enterprise;
        config.buildInfo.env = 'production';

        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.declareIncident.query()).not.toBeInTheDocument();
      });

      it('hides Declare Incident for recording rules', async () => {
        config.buildInfo.edition = GrafanaEdition.Enterprise;
        config.buildInfo.env = 'production';

        const mockRule = getGrafanaRule({
          promRule: mockPromRecordingRule({ type: PromRuleType.Recording }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.declareIncident.query()).not.toBeInTheDocument();
      });
    });

    describe('Assistant availability', () => {
      beforeEach(() => {
        // Reset config to ensure clean state for assistant tests
        config.buildInfo = { ...originalBuildInfo };
        config.buildInfo.env = 'production';
        config.buildInfo.edition = GrafanaEdition.OpenSource;
        // Reset assistant mock to default (unavailable) for each test
        mockUseAssistant.mockReturnValue({
          isAvailable: false,
          openAssistant: mockOpenAssistant,
        } as unknown as ReturnType<typeof useAssistant>);
      });

      it('shows Analyze Rule when assistant is available for Grafana-managed rules', async () => {
        // Override mock to return available
        mockUseAssistant.mockReturnValue({
          isAvailable: true,
          openAssistant: mockOpenAssistant,
        } as unknown as ReturnType<typeof useAssistant>);

        // Create a Grafana rule with promRule that has uid and folderUid
        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({
            uid: 'test-rule-uid',
            folderUid: 'test-folder-uid',
          }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(await ui.menuItems.analyzeRule.find()).toBeInTheDocument();
      });

      it('hides Analyze Rule when assistant is unavailable', async () => {
        // Mock already set to unavailable in beforeEach, but be explicit
        mockUseAssistant.mockReturnValue({
          isAvailable: false,
          openAssistant: mockOpenAssistant,
        } as unknown as ReturnType<typeof useAssistant>);

        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.analyzeRule.query()).not.toBeInTheDocument();
      });

      it('hides Analyze Rule for datasource-managed rules even when assistant is available', async () => {
        mockUseAssistant.mockReturnValue({
          isAvailable: true,
          openAssistant: mockOpenAssistant,
        } as unknown as ReturnType<typeof useAssistant>);

        const datasource = mockDataSource({ uid: 'mimir', name: 'Mimir' });
        const mockRule = getCloudRule({}, { rulesSource: datasource });
        const identifier = fromCombinedRule(datasource.name, mockRule);
        const groupIdentifier = {
          groupOrigin: 'datasource' as const,
          rulesSource: { uid: datasource.uid, name: datasource.name, ruleSourceType: 'datasource' as const },
          namespace: { name: 'namespace-name' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.analyzeRule.query()).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    describe('Missing Data', () => {
      describe('with enrichment feature flags enabled', () => {
        testWithFeatureToggles({
          enable: ['alertEnrichment', 'alertingEnrichmentPerRule'],
        });

        it('hides Manage enrichments when ruleUid is missing even if all other conditions are met', async () => {
          grantUserPermissions([AccessControlAction.AlertingEnrichmentsRead]);
          // Note: Cloud rules typically don't have a ruleUid, so this tests that case
          mockFolderApi(server).folder('namespace-uid', mockFolder({ uid: 'namespace-uid', title: 'Test Folder' }));

          const handleManageEnrichments = jest.fn();
          const datasource = mockDataSource({ uid: 'prometheus', name: 'Prometheus' });
          const mockRule = getCloudRule({}, { rulesSource: datasource });
          const identifier = fromCombinedRule(datasource.name, mockRule);
          const groupIdentifier = {
            groupOrigin: 'datasource' as const,
            rulesSource: { uid: datasource.uid, name: datasource.name, ruleSourceType: 'datasource' as const },
            namespace: { name: 'namespace-name' },
            groupName: 'group-name',
          };

          render(
            <AlertRuleMenu
              promRule={mockRule.promRule}
              rulerRule={mockRule.rulerRule}
              identifier={identifier}
              groupIdentifier={groupIdentifier}
              handleSilence={handleSilence}
              handleDelete={handleDelete}
              handleDuplicateRule={handleDuplicateRule}
              handleManageEnrichments={handleManageEnrichments}
            />
          );

          await openMenu();
          expect(ui.menuItems.manageEnrichments.query()).not.toBeInTheDocument();
        });
      });

      it('hides Pause option when ruleUid is missing even if pause permission is granted', async () => {
        grantUserPermissions([AccessControlAction.AlertingRuleUpdate]);
        setFolderAccessControl({ [AccessControlAction.AlertingRuleUpdate]: true });

        const datasource = mockDataSource({ uid: 'prometheus', name: 'Prometheus' });
        const mockRule = getCloudRule({}, { rulesSource: datasource });
        const identifier = fromCombinedRule(datasource.name, mockRule);
        const groupIdentifier = {
          groupOrigin: 'datasource' as const,
          rulesSource: { uid: datasource.uid, name: datasource.name, ruleSourceType: 'datasource' as const },
          namespace: { name: 'namespace-name' },
          groupName: 'group-name',
        };

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        expect(ui.menuItems.pause.query()).not.toBeInTheDocument();
      });

      it('pause still works when onPauseChange is not provided', async () => {
        grantUserPermissions([AccessControlAction.AlertingRuleUpdate]);
        setFolderAccessControl({ [AccessControlAction.AlertingRuleUpdate]: true });
        mockFolderApi(server).folder(
          'namespace-uid',
          mockFolder({
            uid: 'namespace-uid',
            title: 'Test Folder',
            accessControl: { [AccessControlAction.AlertingRuleUpdate]: true },
          })
        );

        const { mockRule, identifier, groupIdentifier } = createDefaultRuleSetup();

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        await user.click(await ui.menuItems.pause.find());

        // Pause should still execute even without callback
        await waitFor(() => {
          expect(mockPauseExecute).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('Empty States', () => {
      it('shows minimal menu with only Copy Link when no permissions are granted', async () => {
        // Use a non-firing rule to avoid Declare Incident showing
        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        config.buildInfo.edition = GrafanaEdition.OpenSource;
        config.buildInfo.env = 'production';

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();

        expect(await ui.menuItems.copyLink.find()).toBeInTheDocument();
        expect(ui.menuItems.pause.query()).not.toBeInTheDocument();
        expect(ui.menuItems.silence.query()).not.toBeInTheDocument();
        expect(ui.menuItems.duplicate.query()).not.toBeInTheDocument();
        expect(ui.menuItems.export.query()).not.toBeInTheDocument();
        expect(ui.menuItems.delete.query()).not.toBeInTheDocument();
        expect(ui.menuItems.manageEnrichments.query()).not.toBeInTheDocument();
        expect(ui.menuItems.declareIncident.query()).not.toBeInTheDocument();
        expect(ui.menuItems.analyzeRule.query()).not.toBeInTheDocument();
      });

      it('menu still opens even when no applicable items are available', async () => {
        // All abilities denied and no shareUrl
        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        config.buildInfo.edition = GrafanaEdition.OpenSource;
        config.buildInfo.env = 'production';

        // Mock createShareLink to return undefined
        const createShareLinkSpy = jest.spyOn(miscUtils, 'createShareLink');
        createShareLinkSpy.mockReturnValue(undefined);

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();

        expect(ui.menu.query()).toBeInTheDocument();
        const menuItems = screen.queryAllByRole('menuitem');
        const linkItems = screen.queryAllByRole('link');
        expect(menuItems.length).toBe(0);
        expect(linkItems.length).toBe(0);

        createShareLinkSpy.mockRestore();
      });
    });

    describe('Error Handling', () => {
      it('handles gracefully when clipboard API is unavailable', async () => {
        const originalClipboard = navigator.clipboard;
        // Mock clipboard as undefined to simulate unavailable API
        Object.defineProperty(navigator, 'clipboard', {
          value: undefined,
          writable: true,
          configurable: true,
        });

        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        config.buildInfo.edition = GrafanaEdition.OpenSource;
        config.buildInfo.env = 'production';

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();
        const copyLinkItem = await ui.menuItems.copyLink.find();

        await expect(user.click(copyLinkItem)).resolves.not.toThrow();

        // Restore clipboard
        Object.defineProperty(navigator, 'clipboard', {
          value: originalClipboard,
          writable: true,
          configurable: true,
        });
      });

      it('handles gracefully when shareUrl is undefined', async () => {
        // Use a non-firing rule to avoid Declare Incident showing
        const mockRule = getGrafanaRule({
          promRule: mockPromAlertingRule({ state: PromAlertingRuleState.Inactive }),
        });
        const identifier = fromCombinedRule('grafana', mockRule);
        const groupIdentifier = {
          groupOrigin: 'grafana' as const,
          namespace: { uid: 'namespace-uid' },
          groupName: 'group-name',
        };

        config.buildInfo.edition = GrafanaEdition.OpenSource;
        config.buildInfo.env = 'production';

        // Mock createShareLink to return undefined
        const createShareLinkSpy = jest.spyOn(require('app/features/alerting/unified/utils/misc'), 'createShareLink');
        createShareLinkSpy.mockReturnValue(undefined);

        render(
          <AlertRuleMenu
            promRule={mockRule.promRule}
            rulerRule={mockRule.rulerRule}
            identifier={identifier}
            groupIdentifier={groupIdentifier}
            handleSilence={handleSilence}
            handleDelete={handleDelete}
            handleDuplicateRule={handleDuplicateRule}
          />
        );

        await openMenu();

        expect(ui.menuItems.copyLink.query()).not.toBeInTheDocument();
        expect(ui.menu.query()).toBeInTheDocument();

        createShareLinkSpy.mockRestore();
      });
    });
  });
});
