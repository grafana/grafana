import { fireEvent, render, screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { DataSourceAddButton } from './DataSourceAddButton';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

const mockHasPermission = jest.mocked(contextSrv.hasPermission);
const mockReportInteraction = jest.mocked(reportInteraction);

describe('DataSourceAddButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
  });

  it('should report list-page add click for CUJ attribution', () => {
    render(<DataSourceAddButton />);

    fireEvent.click(screen.getByRole('link', { name: /add new data source/i }));

    expect(mockReportInteraction).toHaveBeenCalledWith(
      'connections_datasource_list_add_datasource_clicked',
      {},
      { silent: true }
    );
  });

  it('should not render when user lacks create permission', () => {
    mockHasPermission.mockImplementation((action) => action !== AccessControlAction.DataSourcesCreate);

    render(<DataSourceAddButton />);

    expect(screen.queryByRole('link', { name: /add new data source/i })).not.toBeInTheDocument();
  });
});
