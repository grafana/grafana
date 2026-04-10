import { render, screen, userEvent, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setPluginLinksHook } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { useEnrichmentAbilityState } from '../../hooks/abilities/otherAbilities';
import {
  type RuleEditAbilityResult,
  usePromRuleAbilityState,
  usePromRuleAbilityStates,
  useRuleAdministrationAbility,
  useRuleExportAbility,
  useRuleSilenceAbility,
} from '../../hooks/abilities/ruleAbilities';
import {
  type AbilityState,
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

/** Denied AbilityState for simple cases */
const Denied: AbilityState = NotSupported;

/** A fully-denied RuleEditAbilityResult */
function deniedEditAbility(): RuleEditAbilityResult {
  return { update: Denied, delete: Denied, restore: Denied, pause: Denied, duplicate: Denied, loading: false };
}

/** A fully-granted RuleEditAbilityResult */
function grantedEditAbility(): RuleEditAbilityResult {
  return { update: Granted, delete: Granted, restore: Granted, pause: Granted, duplicate: Granted, loading: false };
}

const mocks = {
  useRuleAdministrationAbility: jest.mocked(useRuleAdministrationAbility),
  useRuleSilenceAbility: jest.mocked(useRuleSilenceAbility),
  useRuleExportAbility: jest.mocked(useRuleExportAbility),
  usePromRuleAbilityState: jest.mocked(usePromRuleAbilityState),
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

    // Default: nothing granted
    mocks.useRuleAdministrationAbility.mockReturnValue(deniedEditAbility());
    mocks.useRuleSilenceAbility.mockReturnValue(Denied);
    mocks.useRuleExportAbility.mockReturnValue(Denied);
    mocks.usePromRuleAbilityState.mockReturnValue(Denied);
    mocks.useEnrichmentAbilityState.mockReturnValue(Denied);

    mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => actions.map(() => Denied));
  });

  describe('Grafana rules action buttons', () => {
    const grafanaRule = getGrafanaRule({ name: 'Grafana' });

    it('Should not render Edit button for users without the update permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: InsufficientPermissions([]),
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Update ? InsufficientPermissions([]) : Denied))
      );

      render(<RulesTable rules={[grafanaRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: InsufficientPermissions([]),
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Delete ? InsufficientPermissions([]) : Denied))
      );

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());

      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: Granted,
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Update ? Granted : Denied))
      );

      render(<RulesTable rules={[grafanaRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: Granted,
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Delete ? Granted : Denied))
      );

      render(<RulesTable rules={[grafanaRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.get()).toBeInTheDocument();
    });

    describe('rules in creating/deleting states', () => {
      const { promRule, ...creatingRule } = grafanaRule;
      const { rulerRule, ...deletingRule } = grafanaRule;
      const rulesSource = 'grafana';

      const preloadedState = {
        unifiedAlerting: { rulerRules: { [rulesSource]: { result: {}, loading: false, dispatched: true } } },
      };

      beforeEach(() => {
        mocks.useRuleAdministrationAbility.mockReturnValue(grantedEditAbility());
        mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) => actions.map(() => Granted));
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
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: InsufficientPermissions([]),
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Update ? InsufficientPermissions([]) : Denied))
      );

      render(<RulesTable rules={[cloudRule]} />);

      await waitFor(() => expect(ui.actionButtons.edit.query()).not.toBeInTheDocument());
    });

    it('Should not render Delete button for users without the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: InsufficientPermissions([]),
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Delete ? InsufficientPermissions([]) : Denied))
      );

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(ui.moreActionItems.delete.query()).not.toBeInTheDocument();
    });

    it('Should render Edit button for users with the update permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        update: Granted,
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Update ? Granted : Denied))
      );

      render(<RulesTable rules={[cloudRule]} />);

      expect(await ui.actionButtons.edit.find()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      mocks.useRuleAdministrationAbility.mockReturnValue({
        ...deniedEditAbility(),
        delete: Granted,
      });
      mocks.usePromRuleAbilityStates.mockImplementation((_rule, actions) =>
        actions.map((action) => (action === RuleAction.Delete ? Granted : Denied))
      );

      render(<RulesTable rules={[cloudRule]} />);

      await user.click(await ui.actionButtons.more.find());
      expect(await ui.moreActionItems.delete.find()).toBeInTheDocument();
    });
  });
});
