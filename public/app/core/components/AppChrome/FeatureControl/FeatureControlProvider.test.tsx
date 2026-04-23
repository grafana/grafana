import { render, screen, act, waitFor } from '@testing-library/react';

import { locationService } from '@grafana/runtime';

import { FeatureControlContextProvider, useFeatureControlContext } from './FeatureControlProvider';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getSearchObject: jest.fn(),
    getLocationObservable: jest.fn(),
  },
}));

describe('FeatureControlProvider', () => {
  const locationServiceMock = jest.mocked(locationService);

  beforeEach(() => {
    jest.clearAllMocks();

    window.localStorage.clear();
    locationServiceMock.getSearchObject.mockReturnValue({});
    locationServiceMock.getLocationObservable.mockReturnValue({
      subscribe: jest.fn().mockReturnValue({
        unsubscribe: jest.fn(),
      }),
    } as never);
  });

  const TestComponent = () => {
    const { corner, isAccessible, isOpen, setCorner, setIsAccessible, setIsOpen } = useFeatureControlContext();

    return (
      <div>
        <div data-testid="is-accessible">{isAccessible.toString()}</div>
        <div data-testid="is-open">{isOpen.toString()}</div>
        <div data-testid="corner">{corner}</div>
        <button onClick={() => setIsAccessible(true)}>Enable accessibility</button>
        <button onClick={() => setIsOpen(true)}>Open feature control</button>
        <button onClick={() => setCorner('top-left')}>Move feature control</button>
      </div>
    );
  };

  it('should provide default context values', () => {
    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('is-accessible')).toHaveTextContent('false');
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('corner')).toHaveTextContent('bottom-right');
  });

  it('should load corner from local storage', () => {
    window.localStorage.setItem('grafana.feature-control.corner', 'top-left');

    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('corner')).toHaveTextContent('top-left');
  });

  it('should load accessibility from local storage', () => {
    window.localStorage.setItem('grafana.feature-control.accessible', 'true');

    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('is-accessible')).toHaveTextContent('true');
  });

  it('should load open state from local storage', () => {
    window.localStorage.setItem('grafana.feature-control.open', 'true');

    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
  });

  it('should fallback to default accessibility when local storage value is invalid', () => {
    window.localStorage.setItem('grafana.feature-control.accessible', 'invalid');

    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('is-accessible')).toHaveTextContent('false');
  });

  it('should fallback to default open state when local storage value is invalid', () => {
    window.localStorage.setItem('grafana.feature-control.open', '123');

    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should fallback to default corner when local storage value is invalid', () => {
    window.localStorage.setItem('grafana.feature-control.corner', 'middle');

    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('corner')).toHaveTextContent('bottom-right');
  });

  it('should force accessibility and open state when featureControl query param is true', () => {
    locationServiceMock.getSearchObject.mockReturnValue({ featureControl: true });

    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    expect(screen.getByTestId('is-accessible')).toHaveTextContent('true');
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(window.localStorage.getItem('grafana.feature-control.accessible')).toBe('true');
    expect(window.localStorage.getItem('grafana.feature-control.open')).toBe('true');
  });

  it('should update accessibility and open state', async () => {
    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    act(() => {
      screen.getByText('Enable accessibility').click();
      screen.getByText('Open feature control').click();
    });

    expect(screen.getByTestId('is-accessible')).toHaveTextContent('true');
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    await waitFor(() => {
      expect(window.localStorage.getItem('grafana.feature-control.accessible')).toBe('true');
      expect(window.localStorage.getItem('grafana.feature-control.open')).toBe('true');
    });
  });

  it('should update corner state', async () => {
    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

    act(() => {
      screen.getByText('Move feature control').click();
    });

    expect(screen.getByTestId('corner')).toHaveTextContent('top-left');
    await waitFor(() => {
      expect(window.localStorage.getItem('grafana.feature-control.corner')).toBe('top-left');
    });
  });
});
