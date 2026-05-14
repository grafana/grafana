import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import * as api from '../api';
import { getMockDataSource } from '../mocks/dataSourcesMocks';
import { initialState } from '../state/reducers';

import { DataSourceDefaultButton } from './DataSourceDefaultButton';

jest.mock('../api', () => ({
  getDataSourceByUid: jest.fn(),
  updateDataSource: jest.fn(),
}));

const mockDataSource = getMockDataSource({
  uid: 'test-uid',
  type: 'prometheus',
  name: 'Test Prometheus',
  typeName: 'Prometheus',
});

const mockApi = jest.mocked(api);

const setup = (dataSource = mockDataSource) => {
  const store = configureStore({
    dataSources: {
      ...initialState,
      dataSources: [dataSource],
      dataSourcesCount: 1,
    },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <DataSourceDefaultButton dataSource={dataSource} />
      </Provider>
    ),
  };
};

describe('DataSourceDefaultButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.getDataSourceByUid.mockResolvedValue(mockDataSource);
    mockApi.updateDataSource.mockResolvedValue(mockDataSource);
  });

  it('should render make default button when data source is not default and editable', () => {
    setup({ ...mockDataSource, isDefault: false });

    expect(screen.getByText('Make default')).toBeInTheDocument();
    expect(screen.queryByText('Remove default')).not.toBeInTheDocument();
  });

  it('should render remove default button when data source is default and editable', () => {
    setup({ ...mockDataSource, isDefault: true });

    expect(screen.getByText('Remove default')).toBeInTheDocument();
    expect(screen.queryByText('Make default')).not.toBeInTheDocument();
  });

  it('updates the datasource list state after updating the default flag', async () => {
    const updatedDataSource = { ...mockDataSource, isDefault: false };
    const store = setup(updatedDataSource).store;

    fireEvent.click(screen.getByText('Make default'));

    await waitFor(() => {
      expect(mockApi.getDataSourceByUid).toHaveBeenCalledWith(mockDataSource.uid);
      expect(mockApi.updateDataSource).toHaveBeenCalledWith({ ...mockDataSource, isDefault: true });
      expect(store.getState().dataSources.dataSources[0].isDefault).toBe(true);
    });
  });
});
