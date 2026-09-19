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

const pick = async (user: UserEvent, input: HTMLElement, option: string) => {
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: option }));
};

const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

describe('KubernetesFiltersButton', () => {
  it('saves the chosen cluster, namespaces, and nodes bound to the datasource, closes, and shows the badge', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);
    expect(screen.queryByText('Filtered')).not.toBeInTheDocument();

    await openGear(user);
    const [clusterInput, namespaceInput, nodeInput] = screen.getAllByRole('combobox');
    await pick(user, clusterInput, 'prod');
    await pick(user, namespaceInput, 'default');
    await pick(user, nodeInput, 'node-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(persisted()).toBe(saved({ cluster: 'prod', namespaces: ['default'], nodes: ['node-1'] }));
    await closed();
    expect(screen.getByText('Filtered')).toBeInTheDocument();
  });

  it('closes without saving on Cancel, offering no Clear while nothing is saved', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await closed();
    expect(persisted()).toBeNull();
  });

  it('shows the saved selection as badge, tooltip, and picker values, and clears it on Clear filters', async () => {
    persist({ cluster: 'prod', namespaces: ['default'] });
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);
    expect(screen.getByText('Filtered')).toBeInTheDocument();

    const dialog = await openGear(user, 'Customize Kubernetes monitoring (filters active)');
    expect(within(dialog).getByDisplayValue('prod')).toBeInTheDocument();
    expect(within(dialog).getByText('default')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Clear filters' }));

    expect(persisted()).toBe('');
    await closed();
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
    await pick(user, clusterInput, 'staging');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(persisted()).toBe(saved({ cluster: 'staging' }));
    await waitFor(() => expect(screen.getByText('Filtered')).toBeInTheDocument());
    expect(screen.queryByText('Filters not applied')).not.toBeInTheDocument();
  });

  it('warns when a picker fails to load, keeps the loaded values, retries once on reopen, then reuses the options', async () => {
    mockFetchOptions.mockResolvedValueOnce({ clusters: null, namespaces: ['default'], nodes: ['node-1'] });
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    expect(await screen.findByText(/Could not load some options/)).toBeInTheDocument();
    const [, namespaceInput] = screen.getAllByRole('combobox');
    await user.click(namespaceInput);
    expect(await screen.findByRole('option', { name: 'default' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await closed();

    await openGear(user);
    const [clusterInput] = screen.getAllByRole('combobox');
    await user.click(clusterInput);
    expect(await screen.findByRole('option', { name: 'prod' })).toBeInTheDocument();
    expect(screen.queryByText(/Could not load some options/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await closed();

    // Complete options are kept for the card's lifetime: a third open costs no query.
    await openGear(user);
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
