import { HttpResponse, http } from 'msw';
import { FormProvider, useForm } from 'react-hook-form';
import { act, render, screen, waitFor } from 'test/test-utils';

import { generatedAPI as notificationsAPIv1beta1 } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { mockComboboxRect } from '@grafana/test-utils';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import { type RuleFormValues } from '../../../types/rule-form';

import { PolicyTreeSelector } from './PolicyTreeSelector';

const server = setupMswServer();

const ROUTING_TREES_URL = '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/:namespace/routingtrees';

const SELECTED_POLICY = 'Managed Policy - Empty Provisioned';

beforeEach(() => {
  mockComboboxRect();
});

function Harness() {
  const formApi = useForm<RuleFormValues>({
    defaultValues: { selectedPolicy: SELECTED_POLICY, labels: [] } as Partial<RuleFormValues> as RuleFormValues,
  });

  return (
    <FormProvider {...formApi}>
      <PolicyTreeSelector />
    </FormProvider>
  );
}

describe('PolicyTreeSelector error handling', () => {
  it('hides itself when the policy list cannot be loaded at all', async () => {
    server.use(http.get(ROUTING_TREES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<Harness />, { preloadedState: {} });

    // Nothing to show and nothing to fall back on, so the section stays out of the form.
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: /select notification policy/i })).not.toBeInTheDocument();
    });
  });

  // This query refetches on mount and on window focus. RTK Query keeps the last good list in the
  // cache alongside the error, so a blip must not take the whole policy section - and the user's
  // current selection with it - off the form mid-edit.
  it('keeps the section and the current selection when a refetch fails after a good load', async () => {
    const { store } = render(<Harness />, { preloadedState: {} });

    expect(await screen.findByDisplayValue(SELECTED_POLICY)).toBeInTheDocument();

    // The endpoint starts failing, and something refetches the entry we share with RoutingTreeSelector.
    server.use(http.get(ROUTING_TREES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    await act(async () => {
      await store!.dispatch(notificationsAPIv1beta1.endpoints.listRoutingTree.initiate({}, { forceRefetch: true }));
    });

    expect(screen.getByRole('combobox', { name: /select notification policy/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue(SELECTED_POLICY)).toBeInTheDocument();
    expect(screen.queryByText(/failed to load notification policies/i)).not.toBeInTheDocument();
  });
});
