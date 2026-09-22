import { type UserEvent } from '@testing-library/user-event';
import { act, render, screen, waitFor, within } from 'test/test-utils';

import { store } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { ctaClicked, solutionFilterChanged } from '../analytics/main';
import { fetchKubernetesLabelValues, kubernetesFilterStorageKey } from '../solutions/kubernetesFilter';
import { deferred, stubDatasource } from '../solutions/test-utils';

import { KubernetesFilterActions } from './KubernetesFilterActions';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn(), solutionFilterChanged: jest.fn() }));

jest.mock('../solutions/kubernetesFilter', () => ({
  ...jest.requireActual('../solutions/kubernetesFilter'),
  fetchKubernetesLabelValues: jest.fn(),
}));

const mockFetchLabelValues = jest.mocked(fetchKubernetesLabelValues);
const mockCtaClicked = jest.mocked(ctaClicked);
const mockFilterChanged = jest.mocked(solutionFilterChanged);

// The comboboxes virtualize their options; without mocked element rects the virtualizer measures 0
// height in jsdom and renders no options.
mockComboboxRect();

const OPEN_GEAR = { name: 'Filter by cluster, namespace, or node' };
const GEAR_OPENED = { surface: 'overview', action: 'open_solution_filter', placement: 'card', solution: 'kubernetes' };

beforeEach(() => {
  window.localStorage.clear();
  mockFetchLabelValues.mockReset();
  mockFetchLabelValues.mockImplementation(async (_uid, key) => (key === 'cluster' ? ['prod', 'staging'] : []));
  mockCtaClicked.mockClear();
  mockFilterChanged.mockClear();
});

afterEach(() => jest.restoreAllMocks());

async function pickCluster(dialog: HTMLElement, user: UserEvent, cluster: string) {
  const combobox = within(dialog).getByRole('combobox', { name: 'Cluster' });
  await waitFor(() => expect(combobox).toBeEnabled());
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: cluster }));
}

describe('KubernetesFilterActions', () => {
  it('saves a cluster and a custom namespace picked in the dialog, highlights the gear and reports the dimensions', async () => {
    const clusters = deferred<string[]>();
    mockFetchLabelValues.mockImplementation((_uid, key) =>
      key === 'cluster' ? clusters.promise : Promise.resolve([])
    );
    const { user } = render(<KubernetesFilterActions datasource={stubDatasource} attention={false} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog', { name: 'Filter Kubernetes Monitoring' });
    // Values still loading, nothing selected, nothing stored: the select waits, Save and Clear do not apply.
    expect(within(dialog).getByRole('combobox', { name: 'Cluster' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await act(async () => clusters.resolve(['prod']));
    await pickCluster(dialog, user, 'prod');
    // The namespace and node lists follow the drafted cluster.
    await waitFor(() => expect(mockFetchLabelValues).toHaveBeenCalledWith('prometheus', 'namespace', 'prod'));

    const namespaces = within(dialog).getByRole('combobox', { name: 'Namespaces' });
    await waitFor(() => expect(namespaces).toBeEnabled());
    await user.type(namespaces, 'team/a');
    await user.click(await screen.findByRole('option', { name: /team\/a/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(kubernetesFilterStorageKey()) ?? '')).toEqual({
      datasourceUid: 'prometheus',
      datasourceName: 'Prometheus',
      cluster: 'prod',
      namespaces: ['team/a'],
      nodes: [],
    });
    expect(
      screen.getByRole('button', { name: 'Edit filters (Cluster: prod · Namespaces: team/a)' })
    ).toBeInTheDocument();
    // Dimension names only; the cluster and namespace values never leave the browser.
    expect(mockCtaClicked).toHaveBeenCalledTimes(1);
    expect(mockCtaClicked).toHaveBeenCalledWith(GEAR_OPENED);
    expect(mockFilterChanged).toHaveBeenCalledTimes(1);
    expect(mockFilterChanged).toHaveBeenCalledWith({
      solution: 'kubernetes',
      change: 'saved',
      customized: 'cluster,namespaces',
    });
  });

  it('reports the gear open but no change when the dialog is cancelled', async () => {
    const { user } = render(<KubernetesFilterActions datasource={stubDatasource} attention={false} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(kubernetesFilterStorageKey())).toBeNull();
    expect(mockCtaClicked).toHaveBeenCalledTimes(1);
    expect(mockCtaClicked).toHaveBeenCalledWith(GEAR_OPENED);
    expect(mockFilterChanged).not.toHaveBeenCalled();
  });

  it('shows a filter saved for another datasource as not applied and lets the user clear it', async () => {
    window.localStorage.setItem(
      kubernetesFilterStorageKey(),
      JSON.stringify({ datasourceUid: 'other', datasourceName: 'Other', cluster: 'prod', namespaces: [], nodes: [] })
    );
    const { user } = render(<KubernetesFilterActions datasource={stubDatasource} attention={false} />);

    expect(screen.getByText('Filters not applied')).toBeInTheDocument();

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog');
    // The draft starts from the stored filter so it can be re-saved for this datasource.
    expect(within(dialog).getByRole('combobox', { name: 'Cluster' })).toHaveDisplayValue('prod');

    await user.click(within(dialog).getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(kubernetesFilterStorageKey())).toBeNull();
    expect(screen.queryByText('Filters not applied')).not.toBeInTheDocument();
    expect(mockFilterChanged).toHaveBeenCalledTimes(1);
    expect(mockFilterChanged).toHaveBeenCalledWith({
      solution: 'kubernetes',
      change: 'cleared',
      customized: '',
    });
  });

  it('keeps the dialog and draft and reports nothing when browser storage rejects the write', async () => {
    // jsdom has no quota, so the failure the store surfaces on a full localStorage is simulated.
    jest.spyOn(store, 'setObject').mockImplementation(() => {
      throw new Error('quota');
    });
    const { user } = render(<KubernetesFilterActions datasource={stubDatasource} attention={false} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog');
    await pickCluster(dialog, user, 'prod');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Could not save to browser storage. Try again.')).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Cluster' })).toHaveDisplayValue('prod');
    expect(window.localStorage.getItem(kubernetesFilterStorageKey())).toBeNull();
    expect(mockFilterChanged).not.toHaveBeenCalled();
  });
});
