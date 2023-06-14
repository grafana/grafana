import { render, screen } from '@testing-library/react';
import { History, Location } from 'history';
import React, { ComponentType } from 'react';
import { match } from 'react-router-dom';
import { TestProvider } from 'test/helpers/TestProvider';

import { setEchoSrv } from '@grafana/runtime';

import { Echo } from '../services/echo/Echo';

import { GrafanaRoute, Props } from './GrafanaRoute';
import { GrafanaRouteComponentProps } from './types';

function setup(overrides: Partial<Props>) {
  const props: Props = {
    location: { search: '?query=hello&test=asd' } as Location,
    history: {} as History,
    match: {} as match,
    route: {
      path: '/',
      component: () => <div />,
    },
    ...overrides,
  };

  render(
    <TestProvider>
      <GrafanaRoute {...props} />
    </TestProvider>
  );
}

describe('GrafanaRoute', () => {
  beforeEach(() => {
    setEchoSrv(new Echo());
  });

  it('Parses search', () => {
    let capturedProps: GrafanaRouteComponentProps;
    const PageComponent = (props: GrafanaRouteComponentProps) => {
      capturedProps = props;
      return <div />;
    };

    setup({ route: { component: PageComponent, path: '' } });
    expect(capturedProps!.queryParams.query).toBe('hello');
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
