import { type UserEvent } from '@testing-library/user-event';
import { render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { KubernetesFiltersButton } from './KubernetesFiltersButton';
import { fetchKubernetesFilterOptions } from './kubernetesData';
import { KUBERNETES_FILTERS_STORAGE_KEY, type KubernetesHomeFilters } from './kubernetesFilters';

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

const persist = (filters: KubernetesHomeFilters) =>
  window.localStorage.setItem(KUBERNETES_FILTERS_STORAGE_KEY, JSON.stringify(filters));
const persisted = () => window.localStorage.getItem(KUBERNETES_FILTERS_STORAGE_KEY);

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

    expect(persisted()).toBe(JSON.stringify({ cluster: 'prod', namespaces: ['default'], nodes: ['node-1'] }));
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

    expect(persisted()).toBe('{}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Filtered')).not.toBeInTheDocument();
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

    expect(persisted()).toBe(JSON.stringify({ cluster: 'edge', namespaces: ['team-z'] }));
  });
});
