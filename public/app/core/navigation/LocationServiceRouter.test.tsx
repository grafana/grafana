import { act, screen } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { useLocation, useNavigationType } from 'react-router-dom-v5-compat';
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
});
