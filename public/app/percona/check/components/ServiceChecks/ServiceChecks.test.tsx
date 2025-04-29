import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom-v5-compat';

import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { ServiceChecks } from './ServiceChecks';

jest.mock('app/percona/check/Check.service');

const setup = () =>
  render(
    <Provider
      store={configureStore({
        percona: {
          user: { isAuthorized: true },
          settings: { loading: false, result: { isConnectedToPortal: false } },
        },
      } as StoreState)}
    >
      {wrapWithGrafanaContextMock(
        <MemoryRouter initialEntries={['/service_1/']}>
          <Routes>
            <Route path="/:service" Component={ServiceChecks} />
          </Routes>
        </MemoryRouter>
      )}
    </Provider>
  );

describe('ServiceChecks', () => {
  it('should show the title with the service name', async () => {
    setup();

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.getByTestId('page-service')).toHaveTextContent('Failed Checks for service "Service One"');
  });

  it('should show "Read More" is a link is available', async () => {
    setup();

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    const links = screen.getAllByTestId('read-more-link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Read More');
    expect(links[0]).toHaveAttribute('href', 'localhost/check-one');
  });
});
