import { act, render, screen, waitFor, within } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';

import { ctaClicked, solutionFilterChanged } from '../analytics/main';
import { solutionFilterStorageKey } from '../solutions/solutionFilter';
import { fetchSyntheticsLabelValues } from '../solutions/syntheticsFilter';
import { deferred, stubDatasource } from '../solutions/test-utils';

import { SyntheticsFilterActions } from './SyntheticsFilterActions';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn(), solutionFilterChanged: jest.fn() }));

jest.mock('../solutions/syntheticsFilter', () => ({
  ...jest.requireActual('../solutions/syntheticsFilter'),
  fetchSyntheticsLabelValues: jest.fn(),
}));

const mockFetchLabelValues = jest.mocked(fetchSyntheticsLabelValues);
const mockCtaClicked = jest.mocked(ctaClicked);
const mockFilterChanged = jest.mocked(solutionFilterChanged);

// The comboboxes virtualize their options; without mocked element rects the virtualizer measures 0
// height in jsdom and renders no options.
mockComboboxRect();

const OPEN_GEAR = { name: 'Ignore checks, targets, or probes' };
const GEAR_OPENED = { surface: 'overview', action: 'open_solution_filter', placement: 'card', solution: 'synthetics' };

beforeEach(() => {
  window.localStorage.clear();
  mockFetchLabelValues.mockReset();
  mockFetchLabelValues.mockImplementation(async (_uid, key) => (key === 'job' ? ['canary', 'checkout'] : []));
  mockCtaClicked.mockClear();
  mockFilterChanged.mockClear();
});

afterEach(() => jest.restoreAllMocks());

describe('SyntheticsFilterActions', () => {
  it('saves a listed check and a typed target, highlights the gear and reports the dimensions', async () => {
    const jobs = deferred<string[]>();
    mockFetchLabelValues.mockImplementation((_uid, key) => (key === 'job' ? jobs.promise : Promise.resolve([])));
    const { user } = render(<SyntheticsFilterActions datasource={stubDatasource} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog', { name: 'Customize Synthetic Monitoring' });
    // Values still loading, nothing selected, nothing stored: the select waits, Save and Clear do not apply.
    expect(within(dialog).getByRole('combobox', { name: 'Ignore checks' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    // Every list is looked up unnarrowed against this card's datasource.
    for (const key of ['job', 'instance', 'probe']) {
      expect(mockFetchLabelValues).toHaveBeenCalledWith('prometheus', key);
    }

    await act(async () => jobs.resolve(['canary', 'checkout']));
    const checks = within(dialog).getByRole('combobox', { name: 'Ignore checks' });
    await waitFor(() => expect(checks).toBeEnabled());
    await user.click(checks);
    await user.click(await screen.findByRole('option', { name: 'canary' }));

    const targets = within(dialog).getByRole('combobox', { name: 'Ignore targets' });
    await user.type(targets, 'https://a.example/x');
    await user.click(await screen.findByRole('option', { name: /https:\/\/a\.example\/x/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(solutionFilterStorageKey('synthetics')) ?? '')).toEqual({
      datasourceUid: 'prometheus',
      datasourceName: 'Prometheus',
      jobs: ['canary'],
      instances: ['https://a.example/x'],
      probes: [],
    });
    expect(
      screen.getByRole('button', {
        name: 'Edit filters (Ignoring checks: canary · Ignoring targets: https://a.example/x)',
      })
    ).toBeInTheDocument();
    // Dimension names only; the check and target values never leave the browser.
    expect(mockCtaClicked).toHaveBeenCalledTimes(1);
    expect(mockCtaClicked).toHaveBeenCalledWith(GEAR_OPENED);
    expect(mockFilterChanged).toHaveBeenCalledTimes(1);
    expect(mockFilterChanged).toHaveBeenCalledWith({
      solution: 'synthetics',
      change: 'saved',
      customized: 'jobs,instances',
    });
  });

  it('shows a filter saved for another datasource as not applied and lets the user clear it', async () => {
    window.localStorage.setItem(
      solutionFilterStorageKey('synthetics'),
      JSON.stringify({
        datasourceUid: 'other',
        datasourceName: 'Other',
        jobs: ['canary'],
        instances: [],
        probes: ['Amsterdam'],
      })
    );
    const { user } = render(<SyntheticsFilterActions datasource={stubDatasource} />);

    expect(screen.getByText('Filters not applied')).toBeInTheDocument();

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog');
    // The draft starts from the stored filter so it can be re-saved for this datasource.
    expect(within(dialog).getByText('canary')).toBeInTheDocument();
    expect(within(dialog).getByText('Amsterdam')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(solutionFilterStorageKey('synthetics'))).toBeNull();
    expect(screen.queryByText('Filters not applied')).not.toBeInTheDocument();
    expect(mockFilterChanged).toHaveBeenCalledTimes(1);
    expect(mockFilterChanged).toHaveBeenCalledWith({
      solution: 'synthetics',
      change: 'cleared',
      customized: '',
    });
  });
});
