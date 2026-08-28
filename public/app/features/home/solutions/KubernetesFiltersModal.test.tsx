import { type UserEvent } from '@testing-library/user-event';
import { render, screen, waitFor, within } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { KubernetesFiltersButton } from './KubernetesFiltersModal';
import { fetchKubernetesFilterOptions, type KubernetesFilterOptions } from './kubernetesData';
import {
  getKubernetesFilters,
  getKubernetesFiltersVersion,
  saveKubernetesFilters,
  subscribeKubernetesFilters,
} from './kubernetesFilters';

jest.mock('./kubernetesData', () => ({
  fetchKubernetesFilterOptions: jest.fn(),
}));

jest.mock('./kubernetesFilters', () => ({
  getKubernetesFilters: jest.fn(),
  saveKubernetesFilters: jest.fn(),
  subscribeKubernetesFilters: jest.fn(),
  getKubernetesFiltersVersion: jest.fn(),
}));

const mockFetchOptions = jest.mocked(fetchKubernetesFilterOptions);
const mockGetFilters = jest.mocked(getKubernetesFilters);
const mockSaveFilters = jest.mocked(saveKubernetesFilters);
const mockSubscribe = jest.mocked(subscribeKubernetesFilters);
const mockGetVersion = jest.mocked(getKubernetesFiltersVersion);

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
  mockGetFilters.mockResolvedValue({});
  mockGetVersion.mockReturnValue(0);
  mockSubscribe.mockReturnValue(() => {});
  mockSaveFilters.mockResolvedValue();
  mockFetchOptions.mockResolvedValue({ clusters: ['prod', 'staging'], namespaces: ['default', 'team-a'] });
});

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
    // Form replaces the loading placeholder once the persisted read settles.
    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows the filtered badge, active tooltip, and seeds the pickers from persisted filters', async () => {
    mockGetFilters.mockResolvedValue({ cluster: 'prod', namespaces: ['default'] });

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    expect(await screen.findByText('Filtered')).toBeInTheDocument();

    const dialog = await openGear(user, 'Customize Kubernetes monitoring (filters active)');

    expect(await within(dialog).findByDisplayValue('prod')).toBeInTheDocument();
    expect(within(dialog).getByText('default')).toBeInTheDocument();
  });

  it('saves the chosen cluster and namespaces then closes', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    await screen.findByRole('button', { name: 'Save' });

    const [clusterInput, namespaceInput] = screen.getAllByRole('combobox');

    await user.click(clusterInput);
    await user.click(await screen.findByRole('option', { name: 'prod' }));

    await user.click(namespaceInput);
    await user.click(await screen.findByRole('option', { name: 'default' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveFilters).toHaveBeenCalledWith({ cluster: 'prod', namespaces: ['default'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the modal open with an error alert when saving fails', async () => {
    mockSaveFilters.mockRejectedValueOnce(new Error('boom'));

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    const saveButton = await screen.findByRole('button', { name: 'Save' });

    await user.click(saveButton);

    expect(await screen.findByText('Could not save filters. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('closes without saving when Cancel is clicked', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    await screen.findByRole('button', { name: 'Save' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockSaveFilters).not.toHaveBeenCalled();
  });

  it('hides Clear filters without persisted filters', async () => {
    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    await screen.findByRole('button', { name: 'Save' });

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('clears persisted filters when Clear filters is clicked', async () => {
    mockGetFilters.mockResolvedValue({ cluster: 'prod' });

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user, 'Customize Kubernetes monitoring (filters active)');

    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(mockSaveFilters).toHaveBeenCalledWith({});
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('warns when some options fail to load but still lists the loaded picker values', async () => {
    mockFetchOptions.mockResolvedValue({ clusters: null, namespaces: ['default'] });

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    await screen.findByRole('button', { name: 'Save' });

    expect(await screen.findByText(/Could not load some options/)).toBeInTheDocument();

    const [, namespaceInput] = screen.getAllByRole('combobox');
    await user.click(namespaceInput);

    expect(await screen.findByRole('option', { name: 'default' })).toBeInTheDocument();
  });

  it('disables both pickers until the options load, then enables them', async () => {
    let resolveOptions!: (options: KubernetesFilterOptions) => void;
    mockFetchOptions.mockReturnValue(
      new Promise((resolve) => {
        resolveOptions = resolve;
      })
    );

    const { user } = render(<KubernetesFiltersButton datasource={datasource} />);

    await openGear(user);
    await screen.findByRole('button', { name: 'Save' });

    const [clusterInput, namespaceInput] = screen.getAllByRole('combobox');
    expect(clusterInput).toBeDisabled();
    expect(namespaceInput).toBeDisabled();

    resolveOptions({ clusters: ['prod'], namespaces: ['default'] });

    await waitFor(() => expect(clusterInput).toBeEnabled());
    expect(namespaceInput).toBeEnabled();
  });
});
