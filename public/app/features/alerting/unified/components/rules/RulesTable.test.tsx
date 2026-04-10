import { render, screen, userEvent, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { useEnrichmentAbilityState } from '../../hooks/abilities/otherAbilities';
import {
  useAllRulerRuleAbilityStates,
  usePromRuleAbilityState,
  usePromRuleAbilityStates,
  useRulerRuleAbilityState,
  useRulerRuleAbilityStates,
} from '../../hooks/abilities/ruleAbilities';
import {
  type AbilityState,
  type AbilityStates,
  Granted,
  InsufficientPermissions,
  NotSupported,
  RuleAction,
} from '../../hooks/abilities/types';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';

import { RulesTable } from './RulesTable';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: jest.fn() }),
}));

jest.mock('../../hooks/abilities/ruleAbilities');
jest.mock('../../hooks/abilities/otherAbilities');

/** Returns Granted or NotSupported/InsufficientPermissions for test mocks */
function toAbilityState(supported: boolean, allowed: boolean): AbilityState {
  if (!supported) {
    return NotSupported;
  }
  return allowed ? Granted : InsufficientPermissions([]);
}

/** Build a full AbilityStates<RuleAction> object where every action returns the same state */
function allActionsState(supported: boolean, allowed: boolean): Record<RuleAction, AbilityState> {
  return Object.fromEntries(
    Object.values(RuleAction).map((action) => [action, toAbilityState(supported, allowed)])
  ) as Record<RuleAction, AbilityState>;
}

const mocks = {
  // RuleActionsButtons uses: useAllRulerRuleAbilityStates (via groupId extracted from CombinedRule)
  // AlertRuleMenu uses: useRulerRuleAbilityStates and usePromRuleAbilityStates (plural)
  useRulerRuleAbilityState: jest.mocked(useRulerRuleAbilityState),
  useAllRulerRuleAbilityStates: jest.mocked(useAllRulerRuleAbilityStates),
  usePromRuleAbilityState: jest.mocked(usePromRuleAbilityState),
  useRulerRuleAbilityStates: jest.mocked(useRulerRuleAbilityStates),
  usePromRuleAbilityStates: jest.mocked(usePromRuleAbilityStates),
  useEnrichmentAbilityState: jest.mocked(useEnrichmentAbilityState),
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

    // Set up default neutral mocks — nothing granted
    const denied = toAbilityState(false, false);
    const deniedAll = allActionsState(false, false);

    mocks.useRulerRuleAbilityState.mockReturnValue(denied);
    mocks.useAllRulerRuleAbilityStates.mockReturnValue(deniedAll);
    mocks.usePromRuleAbilityState.mockReturnValue(denied);
    mocks.useEnrichmentAbilityState.mockReturnValue(denied);

    mocks.useRulerRuleAbilityStates.mockImplementation((_rule, _groupIdentifier, actions) => {
      return actions.map(() => denied);
    });
    mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => {
      return actions.map(() => denied);
    });
  });

  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users without the update permission', async () => {
      // RuleActionsButtons uses useAllRulerRuleAbilityStates for the edit button
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(true, true),
        [RuleAction.Update]: toAbilityState(true, false),
      }));
      // AlertRuleMenu uses plural hooks
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => {
        return actions.map((action) =>
          action === RuleAction.Update ? toAbilityState(true, false) : toAbilityState(true, true)
        );
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(true, true),
        [RuleAction.Delete]: toAbilityState(true, false),
      }));
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => {
        return actions.map((action) =>
          action === RuleAction.Delete ? toAbilityState(true, false) : toAbilityState(true, true)
        );
      });

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());

      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(false, false),
        [RuleAction.Update]: toAbilityState(true, true),
      }));
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => {
        return actions.map((action) =>
          action === RuleAction.Update ? toAbilityState(true, true) : toAbilityState(false, false)
        );
      });

      render(<RulesTable rules={[grafanaRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(false, false),
        [RuleAction.Delete]: toAbilityState(true, true),
      }));
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => {
        return actions.map((action) =>
          action === RuleAction.Delete ? toAbilityState(true, true) : toAbilityState(false, false)
        );
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
        const granted = allActionsState(true, true);
        mocks.useAllRulerRuleAbilityStates.mockReturnValue(granted);
        mocks.useRulerRuleAbilityStates.mockImplementation((_rule, _groupIdentifier, actions) => {
          return actions.map(() => toAbilityState(true, true));
        });
        mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => {
          return actions.map(() => toAbilityState(true, true));
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
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(true, true),
        [RuleAction.Update]: toAbilityState(true, false),
      }));
      // Cloud rules only need useRulerRuleAbilityStates (usePromRuleAbilityStates gets skipToken)
      mocks.useRulerRuleAbilityStates.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) =>
          action === RuleAction.Update ? toAbilityState(true, false) : toAbilityState(true, true)
        );
      });

      render(<RulesTable rules={[cloudRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(true, true),
        [RuleAction.Delete]: toAbilityState(true, false),
      }));
      mocks.useRulerRuleAbilityStates.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) =>
          action === RuleAction.Delete ? toAbilityState(true, false) : toAbilityState(true, true)
        );
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(false, false),
        [RuleAction.Update]: toAbilityState(true, true),
      }));
      mocks.useRulerRuleAbilityStates.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) =>
          action === RuleAction.Update ? toAbilityState(true, true) : toAbilityState(false, false)
        );
      });

      render(<RulesTable rules={[cloudRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useAllRulerRuleAbilityStates.mockImplementation(() => ({
        ...allActionsState(false, false),
        [RuleAction.Delete]: toAbilityState(true, true),
      }));
      mocks.useRulerRuleAbilityStates.mockImplementation((_rule, _groupIdentifier, actions) => {
        return actions.map((action) =>
          action === RuleAction.Delete ? toAbilityState(true, true) : toAbilityState(false, false)
        );
      });

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(await ui.moreActionItems.delete.find()).toBeInTheDocument();
    });
  });
});
