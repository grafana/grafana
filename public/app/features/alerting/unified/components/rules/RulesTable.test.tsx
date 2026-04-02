import { render, screen, userEvent, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import {
  useCombinedRuleAbility,
  useEnrichmentAbility,
  usePromRuleAbilities,
  usePromRuleAbility,
  useRulerRuleAbilities,
  useRulerRuleAbility,
} from '../../hooks/useAbilities';
import { RuleAction } from '../../hooks/useAbilities.types';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RulesTable } from './RulesTable';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

jest.mock('../../hooks/useAbilities');

const mocks = {
  // Mock the hooks that are actually used by the components:
  // RuleActionsButtons uses: useCombinedRuleAbility (singular)
  // AlertRuleMenu uses: useRulerRuleAbilities and usePromRuleAbilities (plural)
  // We can also use usePromRuleAbility (singular) for simpler mocking
  useRulerRuleAbility: jest.mocked(useRulerRuleAbility),
  useCombinedRuleAbility: jest.mocked(useCombinedRuleAbility),
  usePromRuleAbility: jest.mocked(usePromRuleAbility),
  useRulerRuleAbilities: jest.mocked(useRulerRuleAbilities),
  usePromRuleAbilities: jest.mocked(usePromRuleAbilities),
  useEnrichmentAbility: jest.mocked(useEnrichmentAbility),
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
    mocks.useCombinedRuleAbility.mockReturnValue([false, false]);
    mocks.useRulerRuleAbility.mockReturnValue([false, false]);
    mocks.usePromRuleAbility.mockReturnValue([false, false]);
    mocks.useEnrichmentAbility.mockReturnValue([false, false]);

    // Plural hooks (used by AlertRuleMenu) - need to return arrays based on input actions
    mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
      return actions.map(() => [false, false]);
    });
    mocks.usePromRuleAbilities.mockImplementation((_rule, actions) => {
      return actions.map(() => [false, false]);
    });
  });

  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users without the update permission', async () => {
      // Mock the specific hooks needed for Grafana rules
      // Using singular hook for simpler mocking
      mocks.useCombinedRuleAbility.mockImplementation((rule, action) => {
        return action === RuleAction.Update ? [true, false] : [true, true];
      });
      mocks.usePromRuleAbility.mockImplementation((rule, action) => {
        return action === RuleAction.Update ? [true, false] : [true, true];
      });
      // Still need plural hook for AlertRuleMenu component
      mocks.usePromRuleAbilities.mockImplementation((rule, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Update ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      // Mock the specific hooks needed for Grafana rules
      mocks.useCombinedRuleAbility.mockImplementation((rule, action) => {
        return action === RuleAction.Delete ? [true, false] : [true, true];
      });
      mocks.usePromRuleAbilities.mockImplementation((rule, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Delete ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());

      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      // Mock the specific hooks needed for Grafana rules
      mocks.useCombinedRuleAbility.mockImplementation((rule, action) => {
        return action === RuleAction.Update ? [true, true] : [false, false];
      });
      mocks.usePromRuleAbilities.mockImplementation((rule, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Update ? [true, true] : [false, false];
        });
      });

      render(<RulesTable rules={[grafanaRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      // Mock the specific hooks needed for Grafana rules
      mocks.useCombinedRuleAbility.mockImplementation((rule, action) => {
        return action === RuleAction.Delete ? [true, true] : [false, false];
      });
      mocks.usePromRuleAbilities.mockImplementation((rule, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Delete ? [true, true] : [false, false];
        });
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
        mocks.useCombinedRuleAbility.mockImplementation(() => [true, true]);
        // Mock plural hooks for AlertRuleMenu
        mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
          return actions.map(() => [true, true]);
        });
        mocks.usePromRuleAbilities.mockImplementation((_rule, actions) => {
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
        return action === RuleAction.Update ? [true, false] : [true, true];
      });
      mocks.useCombinedRuleAbility.mockImplementation((_rule, action) => {
        return action === RuleAction.Update ? [true, false] : [true, true];
      });
      // Cloud rules only need useRulerRuleAbilities mock (usePromRuleAbilities gets skipToken)
      mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Update ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[cloudRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useRulerRuleAbility.mockImplementation((_rule, _groupIdentifier, action) => {
        return action === RuleAction.Delete ? [true, false] : [true, true];
      });
      mocks.useCombinedRuleAbility.mockImplementation((_rule, action) => {
        return action === RuleAction.Delete ? [true, false] : [true, true];
      });
      // Cloud rules only need useRulerRuleAbilities mock (usePromRuleAbilities gets skipToken)
      mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Delete ? [true, false] : [true, true];
        });
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useRulerRuleAbility.mockImplementation((_rule, _groupIdentifier, action) => {
        return action === RuleAction.Update ? [true, true] : [false, false];
      });
      mocks.useCombinedRuleAbility.mockImplementation((_rule, action) => {
        return action === RuleAction.Update ? [true, true] : [false, false];
      });
      // Cloud rules only need useRulerRuleAbilities mock (usePromRuleAbilities gets skipToken)
      mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Update ? [true, true] : [false, false];
        });
      });

      render(<RulesTable rules={[cloudRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useRulerRuleAbility.mockImplementation((_rule, _groupIdentifier, action) => {
        return action === RuleAction.Delete ? [true, true] : [false, false];
      });
      mocks.useCombinedRuleAbility.mockImplementation((_rule, action) => {
        return action === RuleAction.Delete ? [true, true] : [false, false];
      });
      // Cloud rules only need useRulerRuleAbilities mock (usePromRuleAbilities gets skipToken)
      mocks.useRulerRuleAbilities.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) => {
          return action === RuleAction.Delete ? [true, true] : [false, false];
        });
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(await ui.moreActionItems.delete.find()).toBeInTheDocument();
    });
  });
});
