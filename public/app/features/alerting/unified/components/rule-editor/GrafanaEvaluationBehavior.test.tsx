import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { grafanaRulerRule } from '../../mocks/grafanaRulerApi';
import { DEFAULT_GROUP_EVALUATION_INTERVAL, getDefaultFormValues } from '../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../types/rule-form';

import {
  EvaluationGroupCreationModal,
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

function EvaluationBehaviorWrapper({
  existing,
  group,
  isUngroupedRuleGroup,
}: {
  existing: boolean;
  group: string;
  isUngroupedRuleGroup: boolean;
}) {
  const formApi = useForm<RuleFormValues>({
    defaultValues: { ...getDefaultFormValues(), group, isUngroupedRuleGroup },
    mode: 'onChange',
  });
  return (
    <FormProvider {...formApi}>
      <GrafanaEvaluationBehaviorStep existing={existing} enableProvisionedGroups={false} />
    </FormProvider>
  );
}

const ungroupWarning = /Removing this rule from its group is irreversible/i;

describe('GrafanaEvaluationBehaviorStep — ungroup warning (rulesAPIV2)', () => {
  testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

  it('warns when an existing grouped rule is switched to ungrouped', async () => {
    const { user } = render(<EvaluationBehaviorWrapper existing group="my-group" isUngroupedRuleGroup={false} />);

    expect(screen.queryByText(ungroupWarning)).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Set interval' }));

    expect(await screen.findByText(ungroupWarning)).toBeInTheDocument();
  });

  it('hides the warning again when switching back to using groups', async () => {
    const { user } = render(<EvaluationBehaviorWrapper existing group="my-group" isUngroupedRuleGroup={false} />);

    await user.click(screen.getByRole('radio', { name: 'Set interval' }));
    expect(await screen.findByText(ungroupWarning)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Use groups (Legacy)' }));
    expect(screen.queryByText(ungroupWarning)).not.toBeInTheDocument();
  });

  it('does not show the picker or warning for a rule that was already ungrouped', () => {
    render(<EvaluationBehaviorWrapper existing group={`no_group_for_rule_${'a'.repeat(36)}`} isUngroupedRuleGroup />);

    expect(screen.queryByRole('radio', { name: 'Set interval' })).not.toBeInTheDocument();
    expect(screen.queryByText(ungroupWarning)).not.toBeInTheDocument();
  });

  it('does not warn when a new (non-existing) rule is set to ungrouped', async () => {
    const { user } = render(<EvaluationBehaviorWrapper existing={false} group="" isUngroupedRuleGroup={false} />);

    await user.click(screen.getByRole('radio', { name: 'Set interval' }));

    expect(screen.queryByText(ungroupWarning)).not.toBeInTheDocument();
  });
});

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
