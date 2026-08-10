import { act, screen } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { Link, useLocation, useNavigate, useNavigationType, type NavigateOptions } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';

import { HistoryWrapper } from '@grafana/runtime';

import { LocationServiceRouter } from './LocationServiceRouter';

function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();

  return (
    <>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="search">{location.search || 'no-search'}</div>
      <div data-testid="navigation-type">{navigationType}</div>
    </>
  );
}

function NavigateProbe({ to, options }: { to: string | number; options?: NavigateOptions }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        if (typeof to === 'number') {
          navigate(to);
          return;
        }
        navigate(to, options);
      }}
    >
      navigate
    </button>
  );
}

function setup(initialEntries = ['/start']) {
  return new HistoryWrapper(createMemoryHistory({ initialEntries }));
}

function renderRouter(service: HistoryWrapper, children = <LocationProbe />) {
  // `renderWithRouter: false` keeps the harness from nesting its own router
  // around the component under test.
  return render(<LocationServiceRouter service={service}>{children}</LocationServiceRouter>, {
    renderWithRouter: false,
  });
}

describe('LocationServiceRouter', () => {
  it('renders its children', () => {
    renderRouter(setup(), <div>child content</div>);

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('gives router consumers the location the history starts on', () => {
    renderRouter(setup(['/dashboards?from=now-5m']));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/dashboards');
    expect(screen.getByTestId('search')).toHaveTextContent('?from=now-5m');
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('POP');
  });

  it('re-renders consumers when the history pushes a location', () => {
    const service = setup(['/start']);
    renderRouter(service);

    act(() => {
      service.push('/pushed');
    });

    expect(screen.getByTestId('pathname')).toHaveTextContent('/pushed');
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('PUSH');
  });

  it('re-renders consumers when the history replaces a location', () => {
    const service = setup(['/start']);
    renderRouter(service);

    act(() => {
      service.replace('/replaced');
    });

    expect(screen.getByTestId('pathname')).toHaveTextContent('/replaced');
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE');
  });

  it('re-renders consumers when the history goes back', () => {
    const service = setup(['/first']);
    renderRouter(service);

    act(() => {
      service.push('/second');
    });
    act(() => {
      service.goBack();
    });

    expect(screen.getByTestId('pathname')).toHaveTextContent('/first');
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('POP');
  });

  it('stops listening to the history when it unmounts', () => {
    const service = setup();
    const stopListening = jest.fn();
    const listen = service.listen.bind(service);

    jest.spyOn(service, 'listen').mockImplementation((listener) => {
      const unsubscribe = listen(listener);

      return () => {
        stopListening();
        unsubscribe();
      };
    });

    const { unmount } = renderRouter(service);
    expect(stopListening).not.toHaveBeenCalled();

    unmount();
    expect(stopListening).toHaveBeenCalledTimes(1);
  });

  describe('navigator delegation', () => {
    it('sends a useNavigate push to the history, with its state', async () => {
      const service = setup(['/start']);
      const push = jest.spyOn(service, 'push');
      const { user } = renderRouter(service, <NavigateProbe to="/pushed" options={{ state: { from: 'test' } }} />);

      await user.click(screen.getByRole('button', { name: 'navigate' }));

      expect(push).toHaveBeenCalledTimes(1);
      expect(push.mock.calls[0][1]).toEqual({ from: 'test' });
    });

    it('drops the third argument that react-router sends to push', async () => {
      const service = setup(['/start']);
      const push = jest.spyOn(service, 'push');
      const { user } = renderRouter(service, <NavigateProbe to="/pushed" options={{ preventScrollReset: true }} />);

      await user.click(screen.getByRole('button', { name: 'navigate' }));

      expect(push.mock.calls[0]).toHaveLength(2);
    });

    it('sends a useNavigate replace to the history', async () => {
      const service = setup(['/start']);
      const replace = jest.spyOn(service, 'replace');
      const { user } = renderRouter(service, <NavigateProbe to="/replaced" options={{ replace: true }} />);

      await user.click(screen.getByRole('button', { name: 'navigate' }));

      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace.mock.calls[0]).toHaveLength(2);
    });

    it('sends a relative useNavigate delta to the history', async () => {
      const service = setup(['/start']);
      const go = jest.spyOn(service, 'go');
      const { user } = renderRouter(service, <NavigateProbe to={-1} />);

      await user.click(screen.getByRole('button', { name: 'navigate' }));

      expect(go).toHaveBeenCalledWith(-1);
    });

    it('builds link hrefs with the history', () => {
      const service = setup(['/start']);
      const createHref = jest.spyOn(service, 'createHref');
      renderRouter(service, <Link to="/target">go to target</Link>);

      expect(createHref).toHaveBeenCalled();
      expect(screen.getByRole('link', { name: 'go to target' })).toHaveAttribute('href', '/target');
    });

    it('keeps orgId injection on link hrefs', () => {
      const service = setup(['/start']);
      service.setOrgIdGetter(() => 3);
      renderRouter(service, <Link to="/target">go to target</Link>);

      expect(screen.getByRole('link', { name: 'go to target' })).toHaveAttribute('href', '/target?orgId=3');
    });

    it('keeps orgId injection when navigating', async () => {
      const service = setup(['/start']);
      service.setOrgIdGetter(() => 3);
      const { user } = renderRouter(
        service,
        <>
          <LocationProbe />
          <NavigateProbe to="/pushed" />
        </>
      );

      await user.click(screen.getByRole('button', { name: 'navigate' }));

      expect(screen.getByTestId('pathname')).toHaveTextContent('/pushed');
      expect(screen.getByTestId('search')).toHaveTextContent('?orgId=3');
    });
  });
});
