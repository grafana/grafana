import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, screen, waitFor } from 'test/test-utils';

import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import {
  grafanaRulerGroup2,
  grafanaRulerGroupName2,
  grafanaRulerNamespace,
  grafanaRulerRule,
} from '../../mocks/grafanaRulerApi';
import { DEFAULT_GROUP_EVALUATION_INTERVAL, getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';

import {
  EvaluationGroupCreationModal,
  ForInput,
  GrafanaEvaluationBehaviorStep,
  namespaceToGroupOptions,
} from './GrafanaEvaluationBehavior';

const provisionedRule = {
  ...grafanaRulerRule,
  grafana_alert: { ...grafanaRulerRule.grafana_alert, provenance: 'api' },
};

describe('namespaceToGroupOptions', () => {
  it('excludes virtual ungrouped groups (names prefixed with no_group_for_rule_)', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [
        { name: 'real-group', interval: '1m', rules: [] },
        { name: `no_group_for_rule_${'a'.repeat(36)}`, interval: '1m', rules: [] },
      ],
    };

    const options = namespaceToGroupOptions(namespace, false);

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: 'real-group', value: 'real-group' });
    expect(options.some((o) => o.label?.toString().startsWith('no_group_for_rule_'))).toBe(false);
  });

  it('returns options sorted alphabetically by group name', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [
        { name: 'banana', interval: '1m', rules: [] },
        { name: 'apple', interval: '1m', rules: [] },
        { name: 'cherry', interval: '1m', rules: [] },
      ],
    };

    const options = namespaceToGroupOptions(namespace, false);

    expect(options.map((o) => o.label)).toEqual(['apple', 'banana', 'cherry']);
  });

  it('includes a pending group that is not yet returned by the API', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'existing', interval: '1m', rules: [] }],
    };

    const options = namespaceToGroupOptions(namespace, false, { name: 'just-created', interval: '5m' });

    expect(options.map((o) => o.value)).toEqual(['existing', 'just-created']);
    expect(options.find((o) => o.value === 'just-created')).toMatchObject({
      label: 'just-created',
      description: '5m',
    });
  });

  it('does not duplicate the pending group when it already exists in the namespace', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'existing', interval: '1m', rules: [] }],
    };

    const options = namespaceToGroupOptions(namespace, false, { name: 'existing', interval: '1m' });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: 'existing', description: '1m' });
  });

  it('does not include a pending group whose name is a virtual ungrouped name', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'existing', interval: '1m', rules: [] }],
    };

    const options = namespaceToGroupOptions(namespace, false, {
      name: `no_group_for_rule_${'a'.repeat(36)}`,
      interval: '1m',
    });

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ label: 'existing' });
  });

  it('disables provisioned groups when enableProvisionedGroups is false', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'provisioned-group', interval: '1m', rules: [provisionedRule] }],
    };

    const options = namespaceToGroupOptions(namespace, false);

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      label: 'provisioned-group',
      isProvisioned: true,
      isDisabled: true,
    });
  });

  it('does not disable provisioned groups when enableProvisionedGroups is true', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'provisioned-group', interval: '1m', rules: [provisionedRule] }],
    };

    const options = namespaceToGroupOptions(namespace, true);

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      label: 'provisioned-group',
      isProvisioned: true,
      isDisabled: false,
    });
  });

  it('falls back to the default evaluation interval when a group has no interval', () => {
    const namespace: RulerRulesConfigDTO = {
      'folder-uid': [{ name: 'no-interval', rules: [] }],
    };

    const options = namespaceToGroupOptions(namespace, false);

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      label: 'no-interval',
      description: DEFAULT_GROUP_EVALUATION_INTERVAL,
    });
  });
});

function RuleBasedWrapper() {
  const formApi = useForm<RuleFormValues>({
    defaultValues: { ...getDefaultFormValues(), isUngroupedRuleGroup: true },
    mode: 'onChange',
  });
  return (
    <FormProvider {...formApi}>
      <GrafanaEvaluationBehaviorStep existing={false} enableProvisionedGroups={false} />
    </FormProvider>
  );
}

function GroupCreationModalWrapper() {
  const formApi = useForm<RuleFormValues>({
    defaultValues: getDefaultFormValues(),
  });
  return (
    <FormProvider {...formApi}>
      <EvaluationGroupCreationModal onCreate={jest.fn()} onClose={jest.fn()} />
    </FormProvider>
  );
}

describe('GrafanaEvaluationBehaviorStep — evaluateEvery validation (rule-based mode)', () => {
  it('shows an error for "none" value', async () => {
    const { user } = render(<RuleBasedWrapper />);

    const input = screen.getByRole('textbox', { name: /evaluation interval/i });
    await user.clear(input);
    await user.type(input, 'none');

    expect(
      await screen.findByText('Evaluation interval cannot be None and must be a valid duration.')
    ).toBeInTheDocument();
  });

  it('shows an error when value is too short', async () => {
    const { user } = render(<RuleBasedWrapper />);

    const input = screen.getByRole('textbox', { name: /evaluation interval/i });
    await user.clear(input);
    await user.type(input, '1s');

    expect(await screen.findByText(/Cannot be less than \d+ seconds/)).toBeInTheDocument();
  });

  it('shows an error when value is not a multiple of the minimum', async () => {
    const { user } = render(<RuleBasedWrapper />);

    const input = screen.getByRole('textbox', { name: /evaluation interval/i });
    await user.clear(input);
    await user.type(input, '11s');

    expect(await screen.findByText(/Must be a multiple of \d+ seconds/)).toBeInTheDocument();
  });

  it('shows no error for a valid value', async () => {
    const { user } = render(<RuleBasedWrapper />);

    const input = screen.getByRole('textbox', { name: /evaluation interval/i });
    await user.clear(input);
    await user.type(input, '1m');

    expect(screen.queryByText(/Cannot be less than \d+ seconds/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Must be a multiple of \d+ seconds/)).not.toBeInTheDocument();
  });
});

// Wrapper that puts the form in group-based mode with a real folder UID so the
// ruler namespace API is queried and the group picker is populated.
function GroupBasedWrapper({ evaluateFor }: { evaluateFor: string }) {
  const formApi = useForm<RuleFormValues>({
    defaultValues: {
      ...getDefaultFormValues(),
      // Override type directly — getDefaultFormValues() resolves type via RBAC permissions
      // which are not set up in this unit test context. Setting it explicitly ensures
      // isGrafanaAlertingRule = true so ForInput (pending period) renders.
      type: RuleFormType.grafana,
      isUngroupedRuleGroup: false,
      folder: { uid: grafanaRulerNamespace.uid, title: grafanaRulerNamespace.name },
      evaluateFor,
    },
    mode: 'onChange',
  });
  return (
    <FormProvider {...formApi}>
      <GrafanaEvaluationBehaviorStep existing={false} enableProvisionedGroups={false} />
    </FormProvider>
  );
}

describe('GrafanaEvaluationBehaviorStep — pending period auto-bump on existing group select', () => {
  setupMswServer();

  it('bumps pending period up to the group interval when the current pending period is shorter', async () => {
    // grafanaRulerGroup2 has a 5m interval (served by the default MSW handler).
    // Start with a 1m pending period — shorter than 5m — so the bump must fire.
    render(<GroupBasedWrapper evaluateFor="1m" />);

    const groupPicker = await screen.findByTestId('group-picker');
    await clickSelectOption(groupPicker, grafanaRulerGroupName2);

    // Pending period input should now read the group's interval (5m), not the original 1m.
    const pendingInput = screen.getByRole('textbox', { name: /pending period/i });
    expect(pendingInput).toHaveValue(grafanaRulerGroup2.interval);
  });

  it('does not change the pending period when it is already greater than or equal to the group interval', async () => {
    // Start with 10m pending period — longer than grafanaRulerGroup2's 5m. No bump expected.
    render(<GroupBasedWrapper evaluateFor="10m" />);

    const groupPicker = await screen.findByTestId('group-picker');
    await clickSelectOption(groupPicker, grafanaRulerGroupName2);

    const pendingInput = screen.getByRole('textbox', { name: /pending period/i });
    expect(pendingInput).toHaveValue('10m');
  });

  it('does not change the pending period when it is 0s (immediate-fire sentinel)', async () => {
    // "0s" means fire immediately — the bump must not overwrite it.
    render(<GroupBasedWrapper evaluateFor="0s" />);

    const groupPicker = await screen.findByTestId('group-picker');
    await clickSelectOption(groupPicker, grafanaRulerGroupName2);

    const pendingInput = screen.getByRole('textbox', { name: /pending period/i });
    expect(pendingInput).toHaveValue('0s');
  });
});

// Wrapper that lets tests drive the evaluateEvery prop from outside so the
// useUpdateEffect inside ForInput fires on prop changes.
function ForInputWrapper({
  initialInterval,
  newInterval,
  evaluateFor,
}: {
  initialInterval: string;
  newInterval: string;
  evaluateFor: string;
}) {
  const [evaluateEvery, setEvaluateEvery] = useState(initialInterval);
  const formApi = useForm<RuleFormValues>({
    defaultValues: {
      ...getDefaultFormValues(),
      type: RuleFormType.grafana,
      evaluateFor,
      evaluateEvery: initialInterval,
    },
    mode: 'onChange',
  });
  return (
    <FormProvider {...formApi}>
      <ForInput evaluateEvery={evaluateEvery} />
      <button onClick={() => setEvaluateEvery(newInterval)}>change-interval</button>
    </FormProvider>
  );
}

describe('ForInput — pending period auto-bump on evaluation interval change', () => {
  it('bumps pending period when evaluation interval increases past it', async () => {
    // Start with evaluateEvery=1m and evaluateFor=30s (shorter). Increasing the
    // interval to 5m must auto-bump evaluateFor to 5m.
    const { user } = render(<ForInputWrapper initialInterval="1m" newInterval="5m" evaluateFor="30s" />);

    await user.click(screen.getByRole('button', { name: 'change-interval' }));

    const pendingInput = screen.getByRole('textbox', { name: /pending period/i });
    await waitFor(() => expect(pendingInput).toHaveValue('5m'));
  });

  it('does not change pending period when evaluation interval decreases', async () => {
    // Start with evaluateEvery=5m and evaluateFor=10m (already longer). Decreasing
    // the interval to 1m must leave evaluateFor unchanged.
    const { user } = render(<ForInputWrapper initialInterval="5m" newInterval="1m" evaluateFor="10m" />);

    await user.click(screen.getByRole('button', { name: 'change-interval' }));

    const pendingInput = screen.getByRole('textbox', { name: /pending period/i });
    await waitFor(() => expect(pendingInput).toHaveValue('10m'));
  });

  it('does not change pending period when it is 0s (immediate-fire sentinel)', async () => {
    // 0s sentinel must never be overwritten even when the interval is longer.
    const { user } = render(<ForInputWrapper initialInterval="1m" newInterval="5m" evaluateFor="0s" />);

    await user.click(screen.getByRole('button', { name: 'change-interval' }));

    const pendingInput = screen.getByRole('textbox', { name: /pending period/i });
    await waitFor(() => expect(pendingInput).toHaveValue('0s'));
  });
});

describe('EvaluationGroupCreationModal — evaluateEvery validation', () => {
  it('shows an error for "none" value', async () => {
    const { user } = render(<GroupCreationModalWrapper />);

    const input = screen.getByRole('textbox', { name: /^Evaluation interval/i });
    await user.clear(input);
    await user.type(input, 'none');

    expect(
      await screen.findByText('Evaluation interval cannot be None and must be a valid duration.')
    ).toBeInTheDocument();
  });

  it('shows an error when value is too short', async () => {
    const { user } = render(<GroupCreationModalWrapper />);

    const input = screen.getByRole('textbox', { name: /^Evaluation interval/i });
    await user.clear(input);
    await user.type(input, '1s');

    expect(await screen.findByText(/Cannot be less than \d+ seconds/)).toBeInTheDocument();
  });

  it('shows an error when value is not a multiple of the minimum', async () => {
    const { user } = render(<GroupCreationModalWrapper />);

    const input = screen.getByRole('textbox', { name: /^Evaluation interval/i });
    await user.clear(input);
    await user.type(input, '11s');

    expect(await screen.findByText(/Must be a multiple of \d+ seconds/)).toBeInTheDocument();
  });

  it('shows no error for a valid value', async () => {
    const { user } = render(<GroupCreationModalWrapper />);

    const input = screen.getByRole('textbox', { name: /^Evaluation interval/i });
    await user.clear(input);
    await user.type(input, '1m');

    expect(screen.queryByText(/Cannot be less than \d+ seconds/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Must be a multiple of \d+ seconds/)).not.toBeInTheDocument();
  });
});
