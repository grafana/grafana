import { render, screen } from '@testing-library/react';
import React, { ComponentType } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { setEchoSrv } from '@grafana/runtime';

import { configureStore } from '../../store/configureStore';
import { GrafanaContext } from '../context/GrafanaContext';
import { Echo } from '../services/echo/Echo';

import { GrafanaRoute, Props } from './GrafanaRoute';

function setup(overrides: Partial<Props>) {
  const store = configureStore();
  const props: Props = {
    location: { search: '?query=hello&test=asd' } as any,
    history: {} as any,
    match: {} as any,
    route: {
      path: '/',
      component: () => <div />,
    },
    ...overrides,
  };

  render(
    <BrowserRouter>
      <GrafanaContext.Provider value={getGrafanaContextMock()}>
        <Provider store={store}>
          <GrafanaRoute {...props} />
        </Provider>
      </GrafanaContext.Provider>
    </BrowserRouter>
  );
}

describe('GrafanaRoute', () => {
  beforeEach(() => {
    setEchoSrv(new Echo());
  });

  it('Parses search', () => {
    let capturedProps: any;
    const PageComponent = (props: any) => {
      capturedProps = props;
      return <div />;
    };

    setup({ route: { component: PageComponent, path: '' } });
    expect(capturedProps.queryParams.query).toBe('hello');
  });

  it('Shows loading on lazy load', async () => {
    const PageComponent = React.lazy(() => {
      return new Promise<{ default: ComponentType }>(() => {});
    });

    setup({ route: { component: PageComponent, path: '' } });

    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });

  it('Shows error on page error', async () => {
    const PageComponent = () => {
      throw new Error('Page threw error');
    };

    const consoleError = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(consoleError);

    setup({ route: { component: PageComponent, path: '' } });

    expect(await screen.findByRole('heading', { name: 'An unexpected error happened' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});
