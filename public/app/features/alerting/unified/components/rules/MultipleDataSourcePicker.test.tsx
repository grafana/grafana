import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, useDataSourceInstanceList } from '@grafana/runtime';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { mockDataSource } from '../../mocks';

import { MultipleDataSourcePicker } from './MultipleDataSourcePicker';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return { ...actual, useDataSourceInstanceList: jest.fn(actual.useDataSourceInstanceList) };
});

const runtime = jest.requireActual('@grafana/runtime');
const listHookMock = jest.mocked(useDataSourceInstanceList);

function getInput() {
  return screen.getByTestId(selectors.components.DataSourcePicker.inputV2);
}

function getGroup(label: string) {
  // The heading text sits in a span inside the heading div; the group element wraps the heading and its options.
  return screen.getByText(label).parentElement!.parentElement!;
}

// The picker shows a spinner until every data source list has resolved.
async function waitForDataSourcesToLoad() {
  const container = screen.getByTestId(selectors.components.DataSourcePicker.container);
  await waitFor(() => expect(within(container).queryByTestId('Spinner')).not.toBeInTheDocument());
}

function mockDataSourceListLoading() {
  listHookMock.mockReturnValue({ isLoading: true, items: [] });
}

const originalManageAlertsToggle = config.defaultDatasourceManageAlertsUiToggle;

afterEach(() => {
  listHookMock.mockImplementation(runtime.useDataSourceInstanceList);
  config.defaultDatasourceManageAlertsUiToggle = originalManageAlertsToggle;
});

describe('MultipleDataSourcePicker', () => {
  it('groups options by whether the data source manages alerts', async () => {
    setupDataSources(
      mockDataSource({ name: 'mimir-managing', jsonData: { manageAlerts: true } }, { alerting: true }),
      mockDataSource({ name: 'mimir-not-managing', jsonData: { manageAlerts: false } }, { alerting: true })
    );

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={jest.fn()} />);

    await user.click(getInput());

    await waitFor(() => {
      expect(
        within(getGroup('Data sources with configured alert rules')).getByText('mimir-managing')
      ).toBeInTheDocument();
    });
    expect(within(getGroup('Other data sources')).getByText('mimir-not-managing')).toBeInTheDocument();
  });

  it('lists a data source without settings under other data sources instead of assuming it manages alerts', async () => {
    config.defaultDatasourceManageAlertsUiToggle = true;
    setupDataSources(
      mockDataSource({ name: 'mimir', jsonData: {} }, { alerting: true }),
      mockDataSource({ name: 'without-settings', jsonData: {} }, { alerting: true })
    );
    // The list still returns the data source, but its jsonData cannot be read.
    // eslint-disable-next-line @grafana/no-config-datasources
    delete config.datasources['without-settings'];

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={jest.fn()} />);

    await user.click(getInput());

    await waitFor(() => {
      expect(within(getGroup('Data sources with configured alert rules')).getByText('mimir')).toBeInTheDocument();
    });
    expect(within(getGroup('Other data sources')).getByText('without-settings')).toBeInTheDocument();
  });

  it('only offers alerting-capable data sources when alerting is set', async () => {
    setupDataSources(
      mockDataSource({ name: 'mimir', jsonData: {} }, { alerting: true }),
      mockDataSource({ name: 'tempo', type: 'tempo', jsonData: {} }, { alerting: false, tracing: true })
    );

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={jest.fn()} />);

    await user.click(getInput());

    expect(await screen.findByText('mimir')).toBeInTheDocument();
    expect(screen.queryByText('tempo')).not.toBeInTheDocument();
  });

  it('resolves currently selected names to their data sources', async () => {
    setupDataSources(mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }));

    render(<MultipleDataSourcePicker alerting current={['loki']} onChange={jest.fn()} />);
    await waitForDataSourcesToLoad();

    expect(screen.getByText('loki')).toBeInTheDocument();
  });

  it('resolves a selected data source that the options exclude', async () => {
    setupDataSources(
      mockDataSource({ name: 'tempo', type: 'tempo', jsonData: {} }, { alerting: false, tracing: true })
    );

    render(<MultipleDataSourcePicker alerting current={['tempo']} onChange={jest.fn()} />);
    await waitForDataSourcesToLoad();

    expect(screen.getByText('tempo')).toBeInTheDocument();
    expect(screen.queryByText('tempo - not found')).not.toBeInTheDocument();
  });

  it('shows a "not found" placeholder for a selected name that no longer resolves', async () => {
    setupDataSources();

    render(<MultipleDataSourcePicker alerting current={['missing-ds']} onChange={jest.fn()} />);

    expect(await screen.findByText('missing-ds - not found')).toBeInTheDocument();
  });

  it('shows the selected name, not "not found", while the data source list is loading', async () => {
    setupDataSources(mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }));
    mockDataSourceListLoading();

    render(<MultipleDataSourcePicker alerting current={['loki']} onChange={jest.fn()} />);

    expect(await screen.findByText('loki')).toBeInTheDocument();
    expect(screen.queryByText('loki - not found')).not.toBeInTheDocument();
  });

  it('keeps labels aligned with their names when current is reordered', async () => {
    setupDataSources(
      mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }),
      mockDataSource({ name: 'mimir', jsonData: {} }, { alerting: true })
    );

    const { rerender } = render(<MultipleDataSourcePicker alerting current={['loki', 'mimir']} onChange={jest.fn()} />);
    await waitForDataSourcesToLoad();

    rerender(<MultipleDataSourcePicker alerting current={['mimir', 'loki']} onChange={jest.fn()} />);

    await waitFor(() => {
      const container = screen.getByTestId(selectors.components.DataSourcePicker.container);
      const labels = within(container)
        .getAllByText(/loki|mimir/)
        .map((el) => el.textContent);
      expect(labels).toEqual(['mimir', 'loki']);
    });
  });

  it('shows a loading indicator instead of "No datasources found" while options are resolving', async () => {
    setupDataSources(mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }));
    mockDataSourceListLoading();

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={jest.fn()} />);

    await user.click(getInput());

    expect(screen.getByText('Loading options...')).toBeInTheDocument();
    expect(screen.queryByText('No datasources found')).not.toBeInTheDocument();
  });

  it('hides a selected data source from the menu', async () => {
    setupDataSources(
      mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }),
      mockDataSource({ name: 'mimir', jsonData: {} }, { alerting: true })
    );

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={['loki']} onChange={jest.fn()} />);

    await user.click(getInput());

    await waitFor(() => {
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['mimir']);
    });
  });

  it('calls onChange with the list item when an option is selected', async () => {
    const loki = mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true });
    setupDataSources(loki);
    const onChange = jest.fn();

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={onChange} />);

    await user.click(getInput());
    await user.click(await screen.findByText('loki'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: loki.uid, name: 'loki' }), 'add');
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('jsonData');
  });

  it('calls onChange with the list item when a selected data source is removed', async () => {
    const loki = mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true });
    setupDataSources(loki);
    const onChange = jest.fn();

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={['loki']} onChange={onChange} />);
    await waitForDataSourcesToLoad();

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: loki.uid, name: 'loki' }), 'remove');
  });

  it('calls onChange with the list item when a selected data source that the options exclude is removed', async () => {
    const tempo = mockDataSource({ name: 'tempo', type: 'tempo', jsonData: {} }, { alerting: false, tracing: true });
    setupDataSources(tempo);
    const onChange = jest.fn();

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={['tempo']} onChange={onChange} />);
    await waitForDataSourcesToLoad();

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: tempo.uid, name: 'tempo' }), 'remove');
  });
});
