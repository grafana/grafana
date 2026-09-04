import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import * as runtimeUnstable from '@grafana/runtime/unstable';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { mockDataSource } from '../../mocks';

import { MultipleDataSourcePicker } from './MultipleDataSourcePicker';

function getInput() {
  return screen.getByTestId(selectors.components.DataSourcePicker.inputV2);
}

describe('MultipleDataSourcePicker', () => {
  it('groups options by whether the data source manages alerts', async () => {
    setupDataSources(
      mockDataSource({ name: 'mimir-managing', jsonData: { manageAlerts: true } }, { alerting: true }),
      mockDataSource({ name: 'mimir-not-managing', jsonData: { manageAlerts: false } }, { alerting: true })
    );

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={jest.fn()} />);

    await user.click(getInput());

    expect(await screen.findByText('Data sources with configured alert rules')).toBeInTheDocument();
    expect(screen.getByText('Other data sources')).toBeInTheDocument();
    expect(screen.getByText('mimir-managing')).toBeInTheDocument();
    expect(screen.getByText('mimir-not-managing')).toBeInTheDocument();
  });

  it('resolves currently selected names to their data source settings', async () => {
    setupDataSources(mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }));

    render(<MultipleDataSourcePicker alerting current={['loki']} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('loki')).toBeInTheDocument();
    });
  });

  it('shows a "not found" placeholder for a selected name that no longer resolves', async () => {
    setupDataSources();

    render(<MultipleDataSourcePicker alerting current={['missing-ds']} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('missing-ds - not found')).toBeInTheDocument();
    });
  });

  it('keeps labels aligned with their names when current is reordered', async () => {
    setupDataSources(
      mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }),
      mockDataSource({ name: 'mimir', jsonData: {} }, { alerting: true })
    );

    const { rerender } = render(<MultipleDataSourcePicker alerting current={['loki', 'mimir']} onChange={jest.fn()} />);
    await screen.findByText('loki');

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
    jest.spyOn(runtimeUnstable, 'getDataSourceInstanceList').mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={jest.fn()} />);

    await user.click(getInput());

    expect(screen.getByText('Loading options...')).toBeInTheDocument();
    expect(screen.queryByText('No datasources found')).not.toBeInTheDocument();

    jest.restoreAllMocks();
  });

  it('calls onChange with the resolved data source settings when an option is selected', async () => {
    setupDataSources(mockDataSource({ name: 'loki', jsonData: {} }, { alerting: true }));
    const onChange = jest.fn();

    const user = userEvent.setup();
    render(<MultipleDataSourcePicker alerting current={[]} onChange={onChange} />);

    await user.click(getInput());
    await user.click(await screen.findByText('loki'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'loki' }), 'add');
    });
  });
});
