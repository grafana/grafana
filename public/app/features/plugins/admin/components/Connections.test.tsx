import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { getMockDataSources } from 'app/features/datasources/__mocks__';

import { datasourcePlugin } from '../__mocks__/catalogPlugin.mock';

import Connections from './Connections';

jest.mock('app/features/datasources/state', () => ({
  useLoadDataSource: jest.fn().mockReturnValue({ isLoading: false }),
}));
jest.mock('app/types', () => ({
  useSelector: jest.fn().mockImplementation((selector) => selector({ dataSources: getMockDataSources(2) })),
}));

describe('<Connections>', () => {
  const contextSrv = new ContextSrv();
  contextSrv.hasPermission = jest.fn().mockReturnValue(true);
  setContextSrv(contextSrv);
  const originalLog = console.log;
  console.log = jest.fn((...args) => originalLog(...args));

  it('should render list of datasources', async () => {
    render(<Connections plugin={datasourcePlugin} />);

    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    expect(await screen.findAllByRole('heading')).toHaveLength(2);
    expect(await screen.findByRole('link', { name: /Connections - Data sources/i })).toBeVisible();
    expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(2);
    expect(await screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(2);

    jest.clearAllMocks();
  });

  it('should render add new datasource button when no datasources are defined', async () => {
    render(<Connections plugin={datasourcePlugin} />);

    expect(await screen.findByRole('button', { name: 'Add new datasource' })).toBeInTheDocument();
    expect(screen.getByText(`No data sources defined`)).toBeVisible();
  });
});
