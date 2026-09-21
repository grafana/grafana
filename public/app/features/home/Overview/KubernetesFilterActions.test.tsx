import { type UserEvent } from '@testing-library/user-event';
import { render, screen, waitFor, within } from 'test/test-utils';

import { store } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { fetchKubernetesLabelValues, kubernetesFilterStorageKey } from '../solutions/kubernetesFilter';
import { stubDatasource } from '../solutions/test-utils';

import { KubernetesFilterActions } from './KubernetesFilterActions';

jest.mock('../solutions/kubernetesFilter', () => ({
  ...jest.requireActual('../solutions/kubernetesFilter'),
  fetchKubernetesLabelValues: jest.fn(),
}));

const mockFetchLabelValues = jest.mocked(fetchKubernetesLabelValues);

// The comboboxes virtualize their options; without mocked element rects the virtualizer measures 0
// height in jsdom and renders no options.
mockComboboxRect();

const OPEN_GEAR = { name: 'Filter by cluster, namespace, or node' };

beforeEach(() => {
  window.localStorage.clear();
  mockFetchLabelValues.mockReset();
  mockFetchLabelValues.mockImplementation(async (_uid, key) => (key === 'cluster' ? ['prod', 'staging'] : []));
});

afterEach(() => jest.restoreAllMocks());

async function pickCluster(dialog: HTMLElement, user: UserEvent, cluster: string) {
  await user.click(within(dialog).getByRole('combobox', { name: 'Cluster' }));
  await user.click(await screen.findByRole('option', { name: cluster }));
}

describe('KubernetesFilterActions', () => {
  it('saves a cluster and a custom namespace picked in the dialog and marks the card filtered', async () => {
    const { user } = render(<KubernetesFilterActions datasource={stubDatasource} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog', { name: 'Filter Kubernetes Monitoring' });
    // Nothing selected and nothing stored: neither Save nor Clear applies.
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await pickCluster(dialog, user, 'prod');
    // The namespace and node lists follow the drafted cluster.
    await waitFor(() => expect(mockFetchLabelValues).toHaveBeenCalledWith('prometheus', 'namespace', 'prod'));

    const namespaces = within(dialog).getByRole('combobox', { name: 'Namespaces' });
    await user.type(namespaces, 'custom-ns');
    await user.click(await screen.findByRole('option', { name: /custom-ns/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(kubernetesFilterStorageKey()) ?? '')).toEqual({
      datasourceUid: 'prometheus',
      datasourceName: 'Prometheus',
      cluster: 'prod',
      namespaces: ['custom-ns'],
      nodes: [],
    });
    expect(screen.getByText('Filtered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters applied. Edit filters' })).toBeInTheDocument();
  });

  it('shows a filter saved for another datasource as not applied and lets the user clear it', async () => {
    window.localStorage.setItem(
      kubernetesFilterStorageKey(),
      JSON.stringify({ datasourceUid: 'other', datasourceName: 'Other', cluster: 'prod', namespaces: [], nodes: [] })
    );
    const { user } = render(<KubernetesFilterActions datasource={stubDatasource} />);

    expect(screen.getByText('Filters not applied')).toBeInTheDocument();
    expect(screen.queryByText('Filtered')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog');
    // The draft starts from the stored filter so it can be re-saved for this datasource.
    expect(within(dialog).getByRole('combobox', { name: 'Cluster' })).toHaveDisplayValue('prod');

    await user.click(within(dialog).getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(kubernetesFilterStorageKey())).toBeNull();
    expect(screen.queryByText('Filters not applied')).not.toBeInTheDocument();
  });

  it('keeps the dialog and draft when browser storage rejects the write', async () => {
    // jsdom has no quota, so the failure the store surfaces on a full localStorage is simulated.
    jest.spyOn(store, 'setObject').mockImplementation(() => {
      throw new Error('quota');
    });
    const { user } = render(<KubernetesFilterActions datasource={stubDatasource} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog');
    await pickCluster(dialog, user, 'prod');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Could not save to browser storage. Try again.')).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Cluster' })).toHaveDisplayValue('prod');
    expect(window.localStorage.getItem(kubernetesFilterStorageKey())).toBeNull();
  });
});
