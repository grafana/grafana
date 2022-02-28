import React from 'react';
import { render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import IntegratedAlertingPage from './IntegratedAlertingPage';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getLocationSrv: jest.fn().mockImplementation(() => ({ update: jest.fn() })),
  };
});

jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('IntegratedAlertingPage', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ perconaUser: { isAuthorized: true }, perconaSettings: { isLoading: false } });
    });
  });

  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('renders PageWrapper', async () => {
    await render(<IntegratedAlertingPage {...getRouteComponentProps({ match: { params: { tab: '' } } as any })} />);
    expect(screen.queryByText('Alerts')).toBeInTheDocument();
  });
});
