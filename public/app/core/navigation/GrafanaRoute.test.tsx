import { screen, waitFor } from '@testing-library/react';
import { lazy, type ComponentType } from 'react';
import { render } from 'test/test-utils';

import { setEchoSrv } from '@grafana/runtime';

import { Echo } from '../services/echo/Echo';

import { GrafanaRoute, type Props } from './GrafanaRoute';
import { GRAFANA_ROUTE_CONTENT_READY_EVENT, type RouteContentReadyEventDetail } from './routeContentReady';
import { type GrafanaRouteComponentProps } from './types';

const mockLocation = {
  search: '?query=hello&test=asd',
  pathname: '',
  state: undefined,
  hash: '',
};
function setup(overrides: Partial<Props>) {
  const props: Props = {
    location: mockLocation,
    route: {
      path: '/',
      component: () => <div />,
    },
    ...overrides,
  };

  render(<GrafanaRoute {...props} />);
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
    const PageComponent = lazy(() => {
      return new Promise<{ default: ComponentType }>(() => {});
    });

    setup({ route: { component: PageComponent, path: '' } });

    expect(await screen.findByLabelText('Loading')).toBeInTheDocument();
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

  describe('route-content-ready event', () => {
    let events: Array<CustomEvent<RouteContentReadyEventDetail>>;
    const handler = (e: Event) => events.push(e as CustomEvent<RouteContentReadyEventDetail>);

    beforeEach(() => {
      events = [];
      window.addEventListener(GRAFANA_ROUTE_CONTENT_READY_EVENT, handler);
    });

    afterEach(() => {
      window.removeEventListener(GRAFANA_ROUTE_CONTENT_READY_EVENT, handler);
    });

    it('dispatches once route content has committed', async () => {
      setup({ location: mockLocation, route: { component: () => <div>content</div>, path: '/' } });

      await screen.findByText('content');
      await waitFor(() => expect(events).toHaveLength(1));
      expect(events[0].detail).toEqual({ pathname: '', search: '?query=hello&test=asd', hash: '' });
    });

    it('does not dispatch while the route is suspended on the loading fallback', async () => {
      const PageComponent = lazy(() => new Promise<{ default: ComponentType }>(() => {}));

      setup({ route: { component: PageComponent, path: '' } });

      expect(await screen.findByLabelText('Loading')).toBeInTheDocument();
      expect(events).toHaveLength(0);
    });

    it('dispatches after a suspended lazy route resolves', async () => {
      let resolve!: (value: { default: ComponentType }) => void;
      const PageComponent = lazy(() => new Promise<{ default: ComponentType }>((r) => (resolve = r)));

      setup({ route: { component: PageComponent, path: '' } });

      expect(await screen.findByLabelText('Loading')).toBeInTheDocument();
      expect(events).toHaveLength(0);

      resolve({ default: () => <div>resolved content</div> });

      await screen.findByText('resolved content');
      await waitFor(() => expect(events).toHaveLength(1));
    });

    it('dispatches when the route renders an error page', async () => {
      const PageComponent = () => {
        throw new Error('Page threw error');
      };
      jest.spyOn(console, 'error').mockImplementation(jest.fn());

      setup({ route: { component: PageComponent, path: '' } });

      await screen.findByRole('heading', { name: 'An unexpected error happened' });
      await waitFor(() => expect(events).toHaveLength(1));
    });
  });
});
