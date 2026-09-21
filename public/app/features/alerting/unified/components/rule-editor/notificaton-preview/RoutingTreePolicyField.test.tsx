import { HttpResponse, http } from 'msw';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { ALERTING_API_SERVER_BASE_URL } from 'app/features/alerting/unified/mocks/server/utils';
import { getDefaultFormValues } from 'app/features/alerting/unified/rule-editor/formDefaults';
import { type RuleFormValues } from 'app/features/alerting/unified/types/rule-form';

import { NAMED_ROOT_LABEL_NAME } from '../../notification-policies/useNotificationPolicyRoute';

import { RoutingTreePolicyField } from './RoutingTreePolicyField';

const server = setupMswServer();

beforeAll(() => {
  mockComboboxRect();
});

function FormStateDebug() {
  const { watch } = useFormContext<RuleFormValues>();
  const [selectedPolicy, labels] = watch(['selectedPolicy', 'labels']);

  return (
    <div>
      <span data-testid="selected-policy">{selectedPolicy ?? ''}</span>
      <span data-testid="named-root-label">{labels.find((l) => l.key === NAMED_ROOT_LABEL_NAME)?.value ?? ''}</span>
    </div>
  );
}

function FormWrapper({ formValues }: { formValues?: Partial<RuleFormValues> }) {
  const formApi = useForm<RuleFormValues>({ defaultValues: { ...getDefaultFormValues(), ...formValues } });

  return (
    <FormProvider {...formApi}>
      <RoutingTreePolicyField />
      <FormStateDebug />
    </FormProvider>
  );
}

const CUSTOM_POLICY_NAME = 'Managed Policy - Empty Provisioned';

describe('RoutingTreePolicyField - policy field routing (alertingPolicyRoutingSettings ON)', () => {
  testWithFeatureToggles({ enable: ['alertingPolicyRoutingSettings'] });

  it('shows the collapsed default view when selectedPolicy is unset', async () => {
    render(<FormWrapper />);

    expect(await screen.findByText('Default policy')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the resolved tree expanded when selectedPolicy is already set', async () => {
    render(<FormWrapper formValues={{ selectedPolicy: CUSTOM_POLICY_NAME }} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(CUSTOM_POLICY_NAME)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset to default policy' })).toBeInTheDocument();
    });
  });

  it('writes the selection to selectedPolicy, not the legacy label', async () => {
    const { user } = render(<FormWrapper />);

    await user.click(await screen.findByRole('button', { name: 'Change notification policy' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: new RegExp(CUSTOM_POLICY_NAME) }));

    expect(await screen.findByTestId('selected-policy')).toHaveTextContent(CUSTOM_POLICY_NAME);
    expect(screen.getByTestId('named-root-label')).toHaveTextContent('');
  });

  it('clears selectedPolicy when Reset to default is clicked', async () => {
    const { user } = render(<FormWrapper formValues={{ selectedPolicy: CUSTOM_POLICY_NAME }} />);

    await user.click(await screen.findByRole('button', { name: 'Reset to default policy' }));

    expect(await screen.findByTestId('selected-policy')).toHaveTextContent('');
    expect(await screen.findByText('Default policy')).toBeInTheDocument();
  });
});

describe('RoutingTreePolicyField - legacy label routing (alertingPolicyRoutingSettings OFF)', () => {
  testWithFeatureToggles({ disable: ['alertingPolicyRoutingSettings'] });

  it('writes the selection to the __grafana_managed_route__ label, not selectedPolicy', async () => {
    const { user } = render(<FormWrapper />);

    await user.click(await screen.findByRole('button', { name: 'Change notification policy' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: new RegExp(CUSTOM_POLICY_NAME) }));

    expect(await screen.findByTestId('named-root-label')).toHaveTextContent(CUSTOM_POLICY_NAME);
    expect(screen.getByTestId('selected-policy')).toHaveTextContent('');
  });

  it('pre-selects the tree named by an existing legacy label', async () => {
    render(<FormWrapper formValues={{ labels: [{ key: NAMED_ROOT_LABEL_NAME, value: CUSTOM_POLICY_NAME }] }} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(CUSTOM_POLICY_NAME)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset to default policy' })).toBeInTheDocument();
    });
  });

  it('keeps editing through selectedPolicy for a rule already migrated to it, even with the toggle off', async () => {
    const { user } = render(<FormWrapper formValues={{ selectedPolicy: CUSTOM_POLICY_NAME }} />);

    const resetButton = await screen.findByRole('button', { name: 'Reset to default policy' });
    expect(screen.getByDisplayValue(CUSTOM_POLICY_NAME)).toBeInTheDocument();

    await user.click(resetButton);

    // A policy-field rule stays on selectedPolicy even though the toggle is off - it must never
    // fall through to writing the legacy label instead.
    await waitFor(() => {
      expect(screen.getByTestId('selected-policy')).toHaveTextContent('');
    });
    expect(screen.getByTestId('named-root-label')).toHaveTextContent('');
  });

  it('clears a legacy label that points at a policy tree that no longer exists', async () => {
    render(<FormWrapper formValues={{ labels: [{ key: NAMED_ROOT_LABEL_NAME, value: 'deleted-policy-tree' }] }} />);

    await waitFor(() => {
      expect(screen.getByTestId('named-root-label')).toHaveTextContent('');
    });
  });
});

describe('RoutingTreePolicyField - routing tree list fetch fails', () => {
  it('renders nothing rather than misreporting a custom policy as "Default policy"', async () => {
    server.use(
      http.get(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/routingtrees`, () =>
        HttpResponse.json({ message: 'internal error' }, { status: 500 })
      )
    );

    render(<FormWrapper formValues={{ labels: [{ key: NAMED_ROOT_LABEL_NAME, value: CUSTOM_POLICY_NAME }] }} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /notification policy/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Default policy')).not.toBeInTheDocument();
  });
});
