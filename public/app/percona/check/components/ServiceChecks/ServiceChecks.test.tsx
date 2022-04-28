import React from 'react';
import { Provider } from 'react-redux';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { ServiceChecks } from './ServiceChecks';

jest.mock('app/percona/check/Check.service');

describe('ServiceChecks', () => {
  it('should show the title with the service name', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <ServiceChecks
          {...getRouteComponentProps({
            match: { params: { service: '/service_1/' }, isExact: true, path: '', url: '' },
          })}
        />
      </Provider>
    );
    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.getByTestId('page-service')).toHaveTextContent('Failed Checks for service "Service One"');
  });

  it('should show "Read More" is a link is available', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <ServiceChecks
          {...getRouteComponentProps({
            match: { params: { service: '/service_1/' }, isExact: true, path: '', url: '' },
          })}
        />
      </Provider>
    );
    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    const links = screen.getAllByTestId('read-more-link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Read More');
    expect(links[0]).toHaveAttribute('href', 'localhost/check-one');
  });
});
