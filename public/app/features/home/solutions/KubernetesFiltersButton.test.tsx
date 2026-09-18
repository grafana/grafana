import { type UserEvent } from '@testing-library/user-event';
import { render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { KubernetesFiltersButton } from './KubernetesFiltersButton';
import { fetchKubernetesFilterOptions } from './kubernetesData';
import { KUBERNETES_FILTERS_STORAGE_KEY, type KubernetesFilterValues } from './kubernetesFilters';

jest.mock('./kubernetesData', () => ({
  fetchKubernetesFilterOptions: jest.fn(),
}));

const mockFetchOptions = jest.mocked(fetchKubernetesFilterOptions);

const datasource: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  isDefault: false,
};

// The Combobox virtualizer measures 0 height in jsdom and renders no options without this.
mockComboboxRect();

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockFetchOptions.mockResolvedValue({
    clusters: ['prod', 'staging'],
    namespaces: ['default', 'team-a'],
    nodes: ['node-1', 'node-2'],
  });
});

// Persisted as the modal saves them: values bound to the datasource they were picked from.
const persist = (values: KubernetesFilterValues, datasourceUid = datasource.uid) =>
  window.localStorage.setItem(KUBERNETES_FILTERS_STORAGE_KEY, JSON.stringify({ datasourceUid, values }));
const persisted = () => window.localStorage.getItem(KUBERNETES_FILTERS_STORAGE_KEY);
const saved = (values: KubernetesFilterValues) => JSON.stringify({ datasourceUid: datasource.uid, values });

const openGear = async (user: UserEvent, name = 'Customize Kubernetes monitoring') => {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog', { name: 'Customize Kubernetes monitoring' });
};

describe('KubernetesFiltersButton', () => {
  it('opens the modal when the gear is clicked', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const dialog = await openGear(user);

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows the filtered badge, active tooltip, and seeds the pickers from persisted filters', async () => {
    persist({ cluster: 'prod', namespaces: ['default'] });

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    expect(screen.getByText('Filtered')).toBeInTheDocument();

    const dialog = await openGear(user, 'Customize Kubernetes monitoring (filters active)');

    expect(within(dialog).getByDisplayValue('prod')).toBeInTheDocument();
    expect(within(dialog).getByText('default')).toBeInTheDocument();
  });

  it('saves the chosen cluster, namespaces, and nodes, closes, and shows the badge', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);

    const [clusterInput, namespaceInput, nodeInput] = screen.getAllByRole('combobox');

    await user.click(clusterInput);
    await user.click(await screen.findByRole('option', { name: 'prod' }));

    await user.click(namespaceInput);
    await user.click(await screen.findByRole('option', { name: 'default' }));

    await user.click(nodeInput);
    await user.click(await screen.findByRole('option', { name: 'node-1' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(persisted()).toBe(saved({ cluster: 'prod', namespaces: ['default'], nodes: ['node-1'] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Filtered')).toBeInTheDocument();
  });

  it('closes without saving when Cancel is clicked', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(persisted()).toBeNull();
  });

  it('hides Clear filters without persisted filters', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('clears persisted filters when Clear filters is clicked', async () => {
    persist({ cluster: 'prod' });

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user, 'Customize Kubernetes monitoring (filters active)');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(persisted()).toBe('');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Filtered')).not.toBeInTheDocument();
  });

  it('does not apply a selection saved for another datasource, seeds the modal empty, and rebinds on save', async () => {
    persist({ cluster: 'prod', namespaces: ['default'] }, 'other-uid');

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    expect(screen.getByText('Filters not applied')).toBeInTheDocument();
    expect(screen.queryByText('Filtered')).not.toBeInTheDocument();

    const dialog = await openGear(user);
    expect(within(dialog).queryByDisplayValue('prod')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('default')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();

    const [clusterInput] = screen.getAllByRole('combobox');
    await user.click(clusterInput);
    await user.click(await screen.findByRole('option', { name: 'staging' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(persisted()).toBe(saved({ cluster: 'staging' }));
    await waitFor(() => expect(screen.getByText('Filtered')).toBeInTheDocument());
    expect(screen.queryByText('Filters not applied')).not.toBeInTheDocument();
  });

  it('warns when some options fail to load but still lists the loaded picker values', async () => {
    mockFetchOptions.mockResolvedValue({ clusters: null, namespaces: ['default'], nodes: ['node-1'] });

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);

    expect(await screen.findByText(/Could not load some options/)).toBeInTheDocument();

    const [, namespaceInput] = screen.getAllByRole('combobox');
    await user.click(namespaceInput);

    expect(await screen.findByRole('option', { name: 'default' })).toBeInTheDocument();
  });

  it('loads the options once and reuses them across reopens', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await openGear(user);

    const [clusterInput] = screen.getAllByRole('combobox');
    await user.click(clusterInput);
    expect(await screen.findByRole('option', { name: 'prod' })).toBeInTheDocument();
    expect(mockFetchOptions).toHaveBeenCalledTimes(1);
  });

  it('retries the options on reopen after a picker failed to load', async () => {
    mockFetchOptions.mockResolvedValueOnce({ clusters: null, namespaces: ['default'], nodes: ['node-1'] });
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    expect(await screen.findByText(/Could not load some options/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await openGear(user);

    const [clusterInput] = screen.getAllByRole('combobox');
    await user.click(clusterInput);
    expect(await screen.findByRole('option', { name: 'prod' })).toBeInTheDocument();
    expect(screen.queryByText(/Could not load some options/)).not.toBeInTheDocument();
    expect(mockFetchOptions).toHaveBeenCalledTimes(2);
  });

  it('accepts typed custom values while the options are still loading', async () => {
    mockFetchOptions.mockReturnValue(new Promise(() => {}));

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);

    const [clusterInput, namespaceInput] = screen.getAllByRole('combobox');
    await user.type(clusterInput, 'edge');
    await user.click(await screen.findByRole('option', { name: /^edge/ }));
    await user.type(namespaceInput, 'team-z');
    await user.click(await screen.findByRole('option', { name: /^team-z/ }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(persisted()).toBe(saved({ cluster: 'edge', namespaces: ['team-z'] }));
  });
});
