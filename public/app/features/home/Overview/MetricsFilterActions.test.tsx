import { render, screen, waitFor, within } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';

import { ctaClicked, solutionFilterChanged } from '../analytics/main';
import { solutionFilterStorageKey } from '../solutions/solutionFilter';
import { stubDatasource } from '../solutions/test-utils';

import { MetricsFilterActions } from './MetricsFilterActions';

jest.mock('../analytics/main', () => ({ ctaClicked: jest.fn(), solutionFilterChanged: jest.fn() }));

const mockFilterChanged = jest.mocked(solutionFilterChanged);

// The label combobox virtualizes its options; without mocked element rects the virtualizer measures 0
// height in jsdom and renders no options.
mockComboboxRect();

const OPEN_GEAR = { name: 'Exclude hosts or filesystems from the disk alert' };
const storageKey = () => solutionFilterStorageKey('metrics');

beforeEach(() => {
  window.localStorage.clear();
  jest.mocked(ctaClicked).mockClear();
  mockFilterChanged.mockClear();
});

describe('MetricsFilterActions', () => {
  it('saves an exclusion pattern on the default instance label', async () => {
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
    });
    expect(screen.getByRole('button', { name: 'Edit filters (Excluding instance: cache-.*)' })).toBeInTheDocument();
    expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
      surface: 'overview',
      action: 'open_solution_filter',
      placement: 'card',
      solution: 'metrics',
    });
    expect(mockFilterChanged).toHaveBeenCalledTimes(1);
    expect(mockFilterChanged).toHaveBeenCalledWith({ solution: 'metrics', change: 'saved', customized: 'excludes' });
  });

  it('keeps the dialog open and stores nothing when a typed-in label name is malformed', async () => {
    const { user } = render(<MetricsFilterActions datasource={stubDatasource} attention={false} />);

    await user.click(screen.getByRole('button', OPEN_GEAR));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('combobox', { name: 'Label' }), 'inst-ance');
    await user.click(await screen.findByRole('option', { name: /inst-ance/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Pattern' }), 'cache-.*');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText('Label names may only contain letters, digits and underscores.')
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(storageKey())).toBeNull();
    expect(mockFilterChanged).not.toHaveBeenCalled();
  });
});
