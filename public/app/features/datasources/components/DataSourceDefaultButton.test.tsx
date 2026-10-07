import { render, screen } from '@testing-library/react';

import { useDispatch } from 'app/types/store';

import { getMockDataSource } from '../mocks/dataSourcesMocks';

import { DataSourceDefaultButton } from './DataSourceDefaultButton';

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: jest.fn(),
}));

const mockDataSource = getMockDataSource({
  uid: 'test-uid',
  type: 'prometheus',
  name: 'Test Prometheus',
  typeName: 'Prometheus',
});

const mockDataSourceRights = {
  hasWriteRights: true,
  readOnly: false,
};

jest.mock('../state/hooks', () => ({
  useDataSource: jest.fn(() => mockDataSource),
  useDataSourceRights: jest.fn(() => mockDataSourceRights),
}));

const mockUseDispatch = jest.mocked(useDispatch);
const mockUseDataSource = jest.mocked(require('../state/hooks').useDataSource);
const mockUseDataSourceRights = jest.mocked(require('../state/hooks').useDataSourceRights);

describe('DataSourceDefaultButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDispatch.mockReturnValue(jest.fn());
    mockUseDataSource.mockReturnValue(mockDataSource);
    mockUseDataSourceRights.mockReturnValue(mockDataSourceRights);
  });

  it('should render make default button when data source is not default and editable', () => {
    mockUseDataSource.mockReturnValue({ ...mockDataSource, isDefault: false });

    render(<DataSourceDefaultButton uid="test-uid" />);

    expect(screen.getByText('Make default')).toBeInTheDocument();
    expect(screen.queryByText('Remove default')).not.toBeInTheDocument();
  });

  it('should render remove default button when data source is default and editable', () => {
    mockUseDataSource.mockReturnValue({ ...mockDataSource, isDefault: true });

    render(<DataSourceDefaultButton uid="test-uid" />);

    expect(screen.getByText('Remove default')).toBeInTheDocument();
    expect(screen.queryByText('Make default')).not.toBeInTheDocument();
  });

  it('should not render either button when data source is not editable', () => {
    mockUseDataSource.mockReturnValue({ ...mockDataSource, isDefault: false });
    mockUseDataSourceRights.mockReturnValue({ ...mockDataSourceRights, readOnly: true });

    render(<DataSourceDefaultButton uid="test-uid" />);

    expect(screen.queryByLabelText('Make default')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove default')).not.toBeInTheDocument();
  });

  it('should not render either button when user lacks write permissions', () => {
    mockUseDataSource.mockReturnValue({ ...mockDataSource, isDefault: false });
    mockUseDataSourceRights.mockReturnValue({ ...mockDataSourceRights, hasWriteRights: false });

    render(<DataSourceDefaultButton uid="test-uid" />);

    expect(screen.queryByLabelText('Make default')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove default')).not.toBeInTheDocument();
  });
});
