import { render, screen, userEvent, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { useEnrichmentAbility as useEnrichmentAbilityNew } from '../../hooks/abilities/otherAbilities';
import {
  usePromRuleAdministrationAbility,
  usePromRuleExportAbility,
  usePromRuleSilenceAbility,
} from '../../hooks/abilities/rules/promRuleAbilities';
import { type RuleEditAbilityResult } from '../../hooks/abilities/rules/ruleAbilities.utils';
import {
  useRuleAdministrationAbility,
  useRuleExportAbility,
  useRuleSilenceAbility,
} from '../../hooks/abilities/rules/rulerRuleAbilities';
import { Granted, NotSupported } from '../../hooks/abilities/types';
import {
  AlertRuleAction,
  useAlertRuleAbility,
  useEnrichmentAbility,
  useGrafanaPromRuleAbilities,
  useGrafanaPromRuleAbility,
  useRulerRuleAbilities,
  useRulerRuleAbility,
} from '../../hooks/useAbilities';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RulesTable } from './RulesTable';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

// Legacy hooks — still used by RuleActionsButtons (not yet migrated)
jest.mock('../../hooks/useAbilities');

// New focused ability hooks — used by AlertRuleMenu after migration
jest.mock('../../hooks/abilities/rules/rulerRuleAbilities');
jest.mock('../../hooks/abilities/rules/promRuleAbilities');
jest.mock('../../hooks/abilities/otherAbilities');

const deniedAdminAbilities: RuleEditAbilityResult = {
  update: NotSupported,
  delete: NotSupported,
  pause: NotSupported,
  restore: NotSupported,
  duplicate: NotSupported,
  deletePermanently: NotSupported,
  loading: false,
};

const mocks = {
  // Legacy hooks used by RuleActionsButtons
  useRulerRuleAbility: jest.mocked(useRulerRuleAbility),
  useAlertRuleAbility: jest.mocked(useAlertRuleAbility),
  useGrafanaPromRuleAbility: jest.mocked(useGrafanaPromRuleAbility),
  useRulerRuleAbilities: jest.mocked(useRulerRuleAbilities),
  useGrafanaPromRuleAbilities: jest.mocked(useGrafanaPromRuleAbilities),
  useEnrichmentAbility: jest.mocked(useEnrichmentAbility),
  // New focused hooks used by AlertRuleMenu
  useRuleAdministrationAbility: jest.mocked(useRuleAdministrationAbility),
  useRuleSilenceAbility: jest.mocked(useRuleSilenceAbility),
  useRuleExportAbility: jest.mocked(useRuleExportAbility),
  usePromRuleAdministrationAbility: jest.mocked(usePromRuleAdministrationAbility),
  usePromRuleSilenceAbility: jest.mocked(usePromRuleSilenceAbility),
  usePromRuleExportAbility: jest.mocked(usePromRuleExportAbility),
  useEnrichmentAbilityNew: jest.mocked(useEnrichmentAbilityNew),
};

setPluginLinksHook(() => ({
  links: [],
  isLoading: false,
}));

const ui = {
  actionButtons: {
    edit: byRole('link', { name: 'Edit' }),
    view: byRole('link', { name: 'View' }),
    more: byRole('button', { name: /More/ }),
  },
  moreActionItems: {
    delete: byRole('menuitem', { name: 'Delete' }),
  },
};

const user = userEvent.setup();
setupMswServer();

const { dataSource: mimirDs } = mimirDataSource();

describe('RulesTable RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();

    // Set up default neutral mocks for all hooks
    // Singular hooks (used by RuleActionsButtons and can simplify mocking)
    mocks.useAlertRuleAbility.mockReturnValue([false, false]);
    mocks.useRulerRuleAbility.mockReturnValue([false, false]);
    mocks.useGrafanaPromRuleAbility.mockReturnValue([false, false]);
    mocks.useEnrichmentAbility.mockReturnValue([false, false]);

    // Plural hooks (legacy, used by components not yet migrated)
    mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
      return actions.map(() => [false, false]);
    });
    mocks.useGrafanaPromRuleAbilities.mockImplementation((_rule, actions) => {
      return actions.map(() => [false, false]);
    });

    // New focused ability hooks (used by AlertRuleMenu after migration) — default: all denied
    mocks.useRuleAdministrationAbility.mockReturnValue(deniedAdminAbilities);
    mocks.useRuleSilenceAbility.mockReturnValue(NotSupported);
    mocks.useRuleExportAbility.mockReturnValue(NotSupported);
    mocks.usePromRuleAdministrationAbility.mockReturnValue(deniedAdminAbilities);
    mocks.usePromRuleSilenceAbility.mockReturnValue(NotSupported);
    mocks.usePromRuleExportAbility.mockReturnValue(NotSupported);
    mocks.useEnrichmentAbilityNew.mockReturnValue(NotSupported);
  });

  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users without the update permission', async () => {
      // Mock the specific hooks needed for Grafana rules
      // Using singular hook for simpler mocking
      mocks.useAlertRuleAbility.mockImplementation((rule, action) => {
        return action === AlertRuleAction.Update ? [true, false] : [true, true];
      });
      mocks.useGrafanaPromRuleAbility.mockImplementation((rule, action) => {
        return action === AlertRuleAction.Update ? [true, false] : [true, true];
      });
      // Still need plural hook for AlertRuleMenu component
      mocks.useGrafanaPromRuleAbilities.mockImplementation((rule, actions) => {
        return actions.map((action) => {
          return action === AlertRuleAction.Update ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      // Mock the specific hooks needed for Grafana rules
      mocks.useAlertRuleAbility.mockImplementation((rule, action) => {
        return action === AlertRuleAction.Delete ? [true, false] : [true, true];
      });
      mocks.useGrafanaPromRuleAbilities.mockImplementation((rule, actions) => {
        return actions.map((action) => {
          return action === AlertRuleAction.Delete ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());

      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      // Mock the specific hooks needed for Grafana rules
      mocks.useAlertRuleAbility.mockImplementation((rule, action) => {
        return action === AlertRuleAction.Update ? [true, true] : [false, false];
      });
      mocks.useGrafanaPromRuleAbilities.mockImplementation((rule, actions) => {
        return actions.map((action) => {
          return action === AlertRuleAction.Update ? [true, true] : [false, false];
        });
      });

      render(<RulesTable rules={[grafanaRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((rule, action) => {
        return action === AlertRuleAction.Delete ? [true, true] : [false, false];
      });
      // AlertRuleMenu now uses the focused ability hooks — grant delete via the prom path
      mocks.usePromRuleAdministrationAbility.mockReturnValue({
        ...deniedAdminAbilities,
        delete: Granted,
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.get()).toBeInTheDocument();
    });

    describe('rules in creating/deleting states', () => {
      const { promRule, ...creatingRule } = grafanaRule;
      const { rulerRule, ...deletingRule } = grafanaRule;
      const rulesSource = 'grafana';

      /**
       * Preloaded state that implies the rulerRules have finished loading
       *
       * @todo Remove this state and test at a higher level to avoid mocking the store.
       * We need to manually populate this, as the component hierarchy expects that we will
       * have already called the necessary APIs to get the rulerRules data
       */
      const preloadedState = {
        unifiedAlerting: { rulerRules: { [rulesSource]: { result: {}, loading: false, dispatched: true } } },
      };

      beforeEach(() => {
        // Mock all hooks needed for the creating/deleting state tests
        mocks.useRulerRuleAbility.mockImplementation(() => [true, true]);
        mocks.useAlertRuleAbility.mockImplementation(() => [true, true]);
        // Mock plural hooks for AlertRuleMenu
        mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
          return actions.map(() => [true, true]);
        });
        mocks.useGrafanaPromRuleAbilities.mockImplementation((_rule, actions) => {
          return actions.map(() => [true, true]);
        });
      });

      it('does not render View button when rule is creating', async () => {
        render(<RulesTable rules={[creatingRule]} />, {
          // @ts-ignore
          preloadedState,
        });

        expect(await screen.findByText('Creating')).toBeInTheDocument();
        expect(ui.actionButtons.view.query()).not.toBeInTheDocument();
      });

      it('does not render View or Edit button when rule is deleting', async () => {
        render(<RulesTable rules={[deletingRule]} />, {
          // @ts-ignore
          preloadedState,
        });

        expect(await screen.findByText('Deleting')).toBeInTheDocument();
        expect(ui.actionButtons.view.query()).not.toBeInTheDocument();
        expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
      });
    });
  });

  describe('Cloud rules action buttons', () => {
    const cloudRule = getCloudRule({ name: 'Cloud' }, { rulesSource: mimirDs });

    it('Should not render Edit button for users without the update permission', async () => {
      mocks.useRulerRuleAbility.mockImplementation((_rule, _groupIdentifier, action) => {
        return action === AlertRuleAction.Update ? [true, false] : [true, true];
      });
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, false] : [true, true];
      });
      // Cloud rules only need useRulerRuleAbilities mock (useGrafanaPromRuleAbilities gets skipToken)
      mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) => {
          return action === AlertRuleAction.Update ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[cloudRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useRulerRuleAbility.mockImplementation((_rule, _groupIdentifier, action) => {
        return action === AlertRuleAction.Delete ? [true, false] : [true, true];
      });
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, false] : [true, true];
      });
      // Cloud rules only need useRulerRuleAbilities mock (useGrafanaPromRuleAbilities gets skipToken)
      mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) => {
          return action === AlertRuleAction.Delete ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useRulerRuleAbility.mockImplementation((_rule, _groupIdentifier, action) => {
        return action === AlertRuleAction.Update ? [true, true] : [false, false];
      });
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, true] : [false, false];
      });
      // Cloud rules only need useRulerRuleAbilities mock (useGrafanaPromRuleAbilities gets skipToken)
      mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) => {
          return action === AlertRuleAction.Update ? [true, true] : [false, false];
        });
      });

      render(<RulesTable rules={[cloudRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, true] : [false, false];
      });
      // AlertRuleMenu now uses the focused ability hooks — grant delete via the ruler path
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedAdminAbilities,
        delete: Granted,
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(await ui.moreActionItems.delete.find()).toBeInTheDocument();
    });
  });
});
