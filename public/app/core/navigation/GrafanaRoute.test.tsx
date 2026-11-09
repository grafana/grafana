import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { lazy, type ComponentType, type ReactElement } from 'react';
import { act, getWrapper, render } from 'test/test-utils';

import { setBackendSrv, setEchoSrv } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { StPodReadyService, StPodStatus } from 'app/core/services/StPodReadyService';
import { backendSrv } from 'app/core/services/backend_srv';

import { Echo } from '../services/echo/Echo';

import { GrafanaRoute, type Props } from './GrafanaRoute';
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
    server.use(http.get('/_/status', () => HttpResponse.json({ status: 'active' })));
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

  it('shows the fallback loader once the pod reports it is not ready for a route outside the allow list', async () => {
    server.use(http.get('/_/status', () => HttpResponse.json({ status: 'starting' })));
    await act(async () => {
      setTestFlags({ [FlagKeys.GrafanaMtFallback]: { allowList: ['/dashboards/*'] } });
    });

    await setup({
      location: { ...mockLocation, pathname: '/explore' },
      route: { component: () => <div data-testid="real-page" />, path: '/explore' },
    });

    expect(await screen.findByTestId('page-fallback-loader')).toBeInTheDocument();
  });

  it('restarts the pod check when navigating between non-allow-listed routes after an error', async () => {
    server.use(http.get('/_/status', () => HttpResponse.error()));
    await act(async () => {
      setTestFlags({ [FlagKeys.GrafanaMtFallback]: { allowList: ['/dashboards/*'] } });
    });

    const stPodReady = new StPodReadyService();
    const startSpy = jest.spyOn(stPodReady, 'start');
    const wrapper = getWrapper({ grafanaContext: { stPodReady }, renderWithRouter: true });

    let rerender!: (ui: ReactElement) => void;
    await act(async () => {
      ({ rerender } = render(
        <GrafanaRoute
          location={{ ...mockLocation, pathname: '/explore' }}
          route={{ component: () => <div />, path: '/explore' }}
        />,
        { wrapper }
      ));
    });

    await waitFor(() => expect(stPodReady.getStatus()).toBe(StPodStatus.Error));
    expect(startSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender(
        <GrafanaRoute
          location={{ ...mockLocation, pathname: '/alerting' }}
          route={{ component: () => <div />, path: '/alerting' }}
        />
      );
    });

    expect(startSpy).toHaveBeenCalledTimes(2);

    stPodReady.stop();
  });
});
