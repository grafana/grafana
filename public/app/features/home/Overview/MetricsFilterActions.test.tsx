import { render, screen, waitFor, within } from 'test/test-utils';

import { createDataFrame, FieldType } from '@grafana/data';

import { ctaClicked, solutionFilterChanged } from '../analytics/main';
import { runInstantQueries } from '../solutions/promQuery';
import { solutionFilterStorageKey } from '../solutions/solutionFilter';
import { stubDatasource } from '../solutions/test-utils';

import { MetricsFilterActions } from './MetricsFilterActions';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn(), solutionFilterChanged: jest.fn() }));

jest.mock('../solutions/promQuery', () => ({
  ...jest.requireActual('../solutions/promQuery'),
  runInstantQueries: jest.fn(),
}));

const mockRunInstantQueries = jest.mocked(runInstantQueries);
const mockFilterChanged = jest.mocked(solutionFilterChanged);

const OPEN_GEAR = { name: 'Exclude hosts or filesystems from the disk alert' };
const storageKey = () => solutionFilterStorageKey('metrics');

beforeEach(() => {
  window.localStorage.clear();
  mockRunInstantQueries.mockReset();
  jest.mocked(ctaClicked).mockClear();
  mockFilterChanged.mockClear();
});

describe('MetricsFilterActions', () => {
  it('saves an exclusion pattern on the default instance label without running a query', async () => {
    const { user } = render(<MetricsFilterActions datasource={stubDatasource} attention={false} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog', { name: 'Customize the disk alert' });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox', { name: 'Pattern' }), 'cache-.*');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(storageKey()) ?? '')).toEqual({
      datasourceUid: 'prometheus',
      datasourceName: 'Prometheus',
      excludes: [{ label: 'instance', regex: 'cache-.*' }],
      ratioExpr: '',
    });
    expect(screen.getByRole('button', { name: 'Edit filters (Excluding instance: cache-.*)' })).toBeInTheDocument();
    expect(mockRunInstantQueries).not.toHaveBeenCalled();
    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'overview',
      action: 'open_solution_filter',
      placement: 'card',
      solution: 'metrics',
    });
    expect(mockFilterChanged).toHaveBeenCalledTimes(1);
    expect(mockFilterChanged).toHaveBeenCalledWith({ solution: 'metrics', change: 'saved', customized: 'excludes' });
  });

  it('locks exclusions under a custom expression, blocks one the datasource rejects, and saves once it validates', async () => {
    mockRunInstantQueries.mockRejectedValueOnce(new Error('parse error: unexpected identifier')).mockResolvedValueOnce([
      createDataFrame({
        refId: 'ratio',
        fields: [
          { name: 'Value', type: FieldType.number, values: [0.5], labels: { instance: 'a:9100', mountpoint: '/' } },
        ],
      }),
    ]);
    const { user } = render(<MetricsFilterActions datasource={stubDatasource} attention={false} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog');
    const expression = within(dialog).getByRole('textbox', { name: 'Custom expression' });
    await user.type(expression, 'my ratio');
    // Exclusions are matchers inside the default formula, so a custom one has no place for them.
    expect(within(dialog).getByRole('textbox', { name: 'Pattern' })).toBeDisabled();
    expect(within(dialog).getByText('Add matchers to the custom expression instead.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText('The expression failed: parse error: unexpected identifier')
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(storageKey())).toBeNull();
    expect(mockFilterChanged).not.toHaveBeenCalled();

    await user.clear(expression);
    await user.type(expression, 'my_ratio');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockRunInstantQueries).toHaveBeenCalledTimes(2);
    expect(mockRunInstantQueries).toHaveBeenLastCalledWith({ ratio: 'my_ratio' }, stubDatasource);
    expect(JSON.parse(window.localStorage.getItem(storageKey()) ?? '')).toEqual({
      datasourceUid: 'prometheus',
      datasourceName: 'Prometheus',
      excludes: [],
      ratioExpr: 'my_ratio',
    });
    expect(screen.getByRole('button', { name: 'Edit filters (Custom expression)' })).toBeInTheDocument();
    expect(mockFilterChanged).toHaveBeenCalledTimes(1);
    expect(mockFilterChanged).toHaveBeenCalledWith({ solution: 'metrics', change: 'saved', customized: 'expression' });
  });
});
