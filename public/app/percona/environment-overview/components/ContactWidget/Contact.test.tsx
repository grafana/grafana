import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React, { FC, PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import Contact from './Contact';
import { ContactService } from './Contact.service';

const MockWrapper: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Provider
      store={configureStore({
        percona: {
          user: { isAuthorized: true, isPlatformUser: true },
          settings: { result: { isConnectedToPortal: true } },
        },
      } as StoreState)}
    >
      <Router history={locationService.getHistory()}>{children}</Router>
    </Provider>
  );
};

describe('Contact widget', () => {
  it('render contact when data were fetched successfully', async () => {
    jest.spyOn(ContactService, 'getContact').mockImplementationOnce(() => {
      return Promise.resolve({
        name: 'Test name',
        email: 'test@test.com',
        newTicketUrl: 'test.url',
      });
    });
    render(
      <MockWrapper>
        <Contact />
      </MockWrapper>
    );
    await waitForElementToBeRemoved(() => screen.getByTestId('contact-loading'));

    expect(screen.getByTestId('contact-name').textContent).toBe('Test name');
    expect(screen.getByTestId('contact-email-icon')).toBeInTheDocument();
  });

  it('not render contact when data fetch failed', async () => {
    jest.spyOn(ContactService, 'getContact').mockImplementationOnce(() => {
      throw Error('test');
    });
    render(
      <MockWrapper>
        <Contact />
      </MockWrapper>
    );

    expect(screen.queryByTestId('contact-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contact-email-icon')).not.toBeInTheDocument();
  });
});
