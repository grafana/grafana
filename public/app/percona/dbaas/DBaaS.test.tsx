import React from 'react';
import { useSelector } from 'react-redux';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { DBaaS } from './DBaaS';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('app/core/app_events');
jest.mock('./components/Kubernetes/Kubernetes.hooks');
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getLocationSrv: jest.fn().mockImplementation(() => ({ update: jest.fn() })),
  };
});

describe('DBaaS::', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ perconaUser: { isAuthorized: true }, perconaSettings: { isLoading: false } });
    });
  });

  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('renders PageWrapper', async () => {
    await waitFor(() => render(<DBaaS {...getRouteComponentProps({ match: { params: { tab: '' } } as any })} />));

    expect(screen.getByTestId('dbaas-page-wrapper')).toBeInTheDocument();
  });
});
