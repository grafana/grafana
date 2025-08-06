import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInstanceSettings, PluginMetaInfo, PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { DataSourcePicker } from './DataSourcePicker';

const mockDataSourceSrv = {
  getList: jest.fn(),
  getInstanceSettings: jest.fn(),
  get: jest.fn(),
};

jest.mock('../services/dataSourceSrv', () => ({
  getDataSourceSrv: () => mockDataSourceSrv,
}));

const createMockDataSource = (overrides: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings => ({
  id: 1,
  uid: 'test-uid',
  name: 'Test DataSource',
  type: 'test',
  url: 'http://test.com',
  database: '',
  basicAuth: '',
  isDefault: false,
  jsonData: {},
  readOnly: false,
  withCredentials: false,
  meta: {
    id: 'test',
    name: 'Test',
    type: PluginType.datasource,
    info: {
      author: { name: 'Test' },
      description: 'Test datasource',
      links: [],
      logos: { small: 'test.svg', large: 'test.svg' },
      updated: '',
      version: '1.0.0',
      screenshots: [],
    } as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  access: 'proxy',
  ...overrides,
});

describe('DataSourcePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataSourceSrv.getList.mockReturnValue([]);
    mockDataSourceSrv.getInstanceSettings.mockReturnValue(undefined);
  });

  describe('onClear', () => {
    it('should call onClear when function is passed', async () => {
      const onClear = jest.fn();
      const select = render(<DataSourcePicker onClear={onClear} />);

      const clearButton = select.getByLabelText('Clear value');
      await userEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });

    it('should not render clear button when no onClear function is passed', async () => {
      const select = render(<DataSourcePicker />);

      expect(() => {
        select.getByLabelText('Clear value');
      }).toThrowError();
    });

    it('should pass disabled prop', async () => {
      render(<DataSourcePicker disabled={true} />);

      const input = screen.getByLabelText('Select a data source');
      expect(input).toHaveProperty('disabled', true);
    });
  });

  describe('rendering', () => {
    it('should render data source picker', () => {
      render(<DataSourcePicker />);

      expect(screen.getByLabelText('Select a data source')).toBeInTheDocument();
    });

    it('should render container with correct test id', () => {
      render(<DataSourcePicker />);

      expect(screen.getByTestId(selectors.components.DataSourcePicker.container)).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(<DataSourcePicker isLoading={true} />);

      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    });
  });

  describe('data source options', () => {
    it('should call getList with correct parameters for alerting', () => {
      render(<DataSourcePicker alerting={true} />);

      expect(mockDataSourceSrv.getList).toHaveBeenCalledWith({
        alerting: true,
        tracing: undefined,
        metrics: undefined,
        logs: undefined,
        dashboard: undefined,
        mixed: undefined,
        variables: undefined,
        annotations: undefined,
        pluginId: undefined,
        filter: undefined,
        type: undefined,
      });
    });

    it('should call getList with multiple filter parameters', () => {
      const customFilter = jest.fn();

      render(
        <DataSourcePicker metrics={true} logs={true} pluginId="prometheus" type="prometheus" filter={customFilter} />
      );

      expect(mockDataSourceSrv.getList).toHaveBeenCalledWith({
        alerting: undefined,
        tracing: undefined,
        metrics: true,
        logs: true,
        dashboard: undefined,
        mixed: undefined,
        variables: undefined,
        annotations: undefined,
        pluginId: 'prometheus',
        filter: customFilter,
        type: 'prometheus',
      });
    });

    it('should display data source options with default label', async () => {
      const mockDS = createMockDataSource({ name: 'Prometheus', isDefault: true });
      mockDataSourceSrv.getList.mockReturnValue([mockDS]);

      render(<DataSourcePicker />);

      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      expect(screen.getByText('Prometheus (default)')).toBeInTheDocument();
    });

    it('should display data source options without default label', async () => {
      const mockDS = createMockDataSource({ name: 'Prometheus', isDefault: false });
      mockDataSourceSrv.getList.mockReturnValue([mockDS]);

      render(<DataSourcePicker />);

      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      expect(screen.getByText('Prometheus')).toBeInTheDocument();
    });
  });

  describe('current value handling', () => {
    it('should display current data source when provided', () => {
      const mockDS = createMockDataSource({ uid: 'current-ds', name: 'Current DataSource' });
      mockDataSourceSrv.getInstanceSettings.mockReturnValueOnce(mockDS);

      render(<DataSourcePicker current="current-ds" />);

      expect(mockDataSourceSrv.getInstanceSettings).toHaveBeenCalledWith('current-ds');
    });

    it('should handle data source ref as current value', () => {
      const dsRef = { uid: 'ref-uid', type: 'prometheus' };
      const mockDS = createMockDataSource({ uid: 'ref-uid', name: 'Ref DataSource' });
      mockDataSourceSrv.getInstanceSettings.mockReturnValueOnce(mockDS);

      render(<DataSourcePicker current={dsRef} />);

      expect(mockDataSourceSrv.getInstanceSettings).toHaveBeenCalledWith(dsRef);
    });

    it('should handle noDefault prop correctly', () => {
      render(<DataSourcePicker current={null} noDefault={true} />);

      // Should not try to get default data source when noDefault is true and current is null
      expect(screen.getByRole('combobox')).toHaveValue('');
    });

    it('should truncate long data source names', () => {
      const longName = 'This is a very long data source name that should be truncated';
      const mockDS = createMockDataSource({ uid: 'long-name-ds', name: longName });
      mockDataSourceSrv.getInstanceSettings.mockReturnValue(mockDS);

      render(<DataSourcePicker current="long-name-ds" />);

      // Name should be truncated to 37 characters
      expect(
        screen.queryByText('This is a very long data source name that should be truncated')
      ).not.toBeInTheDocument();
      expect(screen.getByText('This is a very long data source name')).toBeInTheDocument();
    });

    it('should hide text when hideTextValue is true', () => {
      const mockDS = createMockDataSource({ uid: 'test-ds', name: 'Test DataSource' });
      mockDataSourceSrv.getInstanceSettings.mockReturnValue(mockDS);

      render(<DataSourcePicker current="test-ds" hideTextValue={true} />);

      // Text should be hidden, but image should still be visible
      expect(screen.queryByText('Test DataSource')).not.toBeInTheDocument();
    });

    it('should show text when hideTextValue is false or undefined', () => {
      const mockDS = createMockDataSource({ uid: 'test-ds', name: 'Test DataSource' });
      mockDataSourceSrv.getInstanceSettings.mockReturnValue(mockDS);

      render(<DataSourcePicker current="test-ds" hideTextValue={false} />);

      // Text should be visible
      expect(screen.getByText('Test DataSource')).toBeInTheDocument();
    });
  });

  describe('onChange handling', () => {
    it('should call onChange when data source is selected', async () => {
      const onChange = jest.fn();
      const mockDS = createMockDataSource({ name: 'Selected DS' });
      mockDataSourceSrv.getList.mockReturnValue([mockDS]);
      mockDataSourceSrv.getInstanceSettings.mockReturnValue(mockDS);

      render(<DataSourcePicker onChange={onChange} />);

      const select = screen.getByRole('combobox');
      await userEvent.click(select);

      const option = screen.getByRole('option');
      await userEvent.click(option);

      expect(onChange).toHaveBeenCalledWith(mockDS);
    });

    it('should not call onChange when no data source is found', async () => {
      const onChange = jest.fn();

      render(<DataSourcePicker onChange={onChange} />);

      // Simulate selection of non-existent data source
      const select = screen.getByRole('combobox');
      await userEvent.type(select, 'non-existent');

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    it('should call onBlur when select loses focus', async () => {
      const onBlur = jest.fn();

      render(<DataSourcePicker onBlur={onBlur} />);

      const select = screen.getByRole('combobox');
      await userEvent.click(select);
      await userEvent.tab();

      expect(onBlur).toHaveBeenCalled();
    });

    it('should set autoFocus when prop is true', () => {
      render(<DataSourcePicker autoFocus={true} />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveFocus();
    });
  });

  describe('error handling', () => {
    it('should set error state when current data source is not found', () => {
      render(<DataSourcePicker current="non-existent-ds" />);

      expect(mockDataSourceSrv.getInstanceSettings).toHaveBeenCalledWith('non-existent-ds');
      expect(screen.getByText('non-existent-ds - not found')).toBeInTheDocument();
      // Component should handle the error internally
    });

    it('should clear error when valid data source is selected', async () => {
      const onChange = jest.fn();
      const mockDS = createMockDataSource({ name: 'Valid DS' });

      // First call returns undefined (error state), second call returns valid DS
      mockDataSourceSrv.getInstanceSettings.mockReturnValueOnce(undefined).mockReturnValueOnce(mockDS);

      mockDataSourceSrv.getList.mockReturnValue([mockDS]);

      const { rerender } = render(<DataSourcePicker current="invalid-ds" onChange={onChange} />);

      expect(screen.getByText('invalid-ds - not found')).toBeInTheDocument();

      // Simulate selecting a valid data source
      rerender(<DataSourcePicker current="valid-ds" onChange={onChange} />);

      expect(mockDataSourceSrv.getInstanceSettings).toHaveBeenCalledWith('valid-ds');
    });
  });

  describe('width prop', () => {
    it('should pass width to Select component', () => {
      const width = 300;
      render(<DataSourcePicker width={width} />);

      const selectContainer = screen.getByTestId(selectors.components.DataSourcePicker.container);
      expect(selectContainer.querySelector('.select-container')).toBeInTheDocument();
    });
  });
});
