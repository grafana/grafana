import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { lazy, type ComponentType } from 'react';
import { act, render } from 'test/test-utils';

import { setBackendSrv, setEchoSrv } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { Echo } from '../services/echo/Echo';

import { GrafanaRoute, type Props } from './GrafanaRoute';
import { invalidateStPodReadiness } from './stPodReadiness';
import { type GrafanaRouteComponentProps } from './types';

setBackendSrv(backendSrv);
setupMockServer();

const mockLocation = {
  search: '?query=hello&test=asd',
  pathname: '',
  state: undefined,
  hash: '',
};

// The readiness gate suspends during its first render for routes that are not allow-listed,
// and React requires the surrounding act() to be awaited when a component suspends.
async function setup(overrides: Partial<Props>) {
  const props: Props = {
    location: mockLocation,
    route: {
      path: '/',
      component: () => <div />,
    },
    ...overrides,
  };

  await act(async () => {
    render(<GrafanaRoute {...props} />);
  });
}

describe('GrafanaRoute', () => {
  beforeEach(() => {
    setEchoSrv(new Echo());
    invalidateStPodReadiness();
  });

  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('Parses search', async () => {
    let capturedProps: GrafanaRouteComponentProps;
    const PageComponent = (props: GrafanaRouteComponentProps) => {
      capturedProps = props;
      return <div />;
    };

    await setup({ route: { component: PageComponent, path: '' } });

    expect(capturedProps!.queryParams.query).toBe('hello');
  });

  it('Shows loading on lazy load', async () => {
    const PageComponent = lazy(() => {
      return new Promise<{ default: ComponentType }>(() => {});
    });

    await setup({ route: { component: PageComponent, path: '' } });

    expect(await screen.findByLabelText('Loading')).toBeInTheDocument();
  });

  it('Shows error on page error', async () => {
    const PageComponent = () => {
      throw new Error('Page threw error');
    };

    const consoleError = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(consoleError);

    await setup({ route: { component: PageComponent, path: '' } });

    expect(await screen.findByRole('heading', { name: 'An unexpected error happened' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it('shows the fallback loader instead of the route component for a route outside the allow list', async () => {
    server.use(http.get('/api/health', () => HttpResponse.json({ code: 'NotFound' }, { status: 404 })));
    await act(async () => {
      setTestFlags({ [FlagKeys.GrafanaMtFallback]: { allowList: ['/dashboards/*'] } });
    });

    await setup({
      location: { ...mockLocation, pathname: '/explore' },
      route: { component: () => <div data-testid="real-page" />, path: '/explore' },
    });

    expect(await screen.findByTestId('page-fallback-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('real-page')).not.toBeInTheDocument();
  });
});
