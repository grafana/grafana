import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationService } from '@grafana/runtime';

import { FeatureControlContextProvider, useFeatureControlContext } from './FeatureControlProvider';

const STORAGE_KEYS = {
  accessible: 'grafana.feature-control.accessible',
  open: 'grafana.feature-control.open',
} as const;

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
    const { isAccessible, setIsAccessible, isOpen, setIsOpen } = useFeatureControlContext();

    return (
      <div>
        <div data-testid="is-accessible">{isAccessible.toString()}</div>
        <div data-testid="is-open">{isOpen.toString()}</div>
        <button onClick={() => setIsAccessible(true)}>Enable accessibility</button>
        <button onClick={() => setIsOpen(true)}>Open feature control</button>
      </div>
    );
  };

  const renderProvider = () =>
    render(
      <FeatureControlContextProvider>
        <TestComponent />
      </FeatureControlContextProvider>
    );

  const expectState = ({ isAccessible, isOpen }: { isAccessible: boolean; isOpen: boolean }) => {
    expect(screen.getByTestId('is-accessible')).toHaveTextContent(isAccessible.toString());
    expect(screen.getByTestId('is-open')).toHaveTextContent(isOpen.toString());
  };

  const expectStorage = ({ isAccessible, isOpen }: { isAccessible: string | null; isOpen: string | null }) => {
    expect(window.localStorage.getItem(STORAGE_KEYS.accessible)).toBe(isAccessible);
    expect(window.localStorage.getItem(STORAGE_KEYS.open)).toBe(isOpen);
  };

  it('should provide default context values', () => {
    renderProvider();

    expectState({ isAccessible: false, isOpen: false });
  });

  it.each([
    ['accessibility', STORAGE_KEYS.accessible, 'true', { isAccessible: true, isOpen: false }],
    ['open state', STORAGE_KEYS.open, 'true', { isAccessible: false, isOpen: true }],
    ['accessibility with invalid value', STORAGE_KEYS.accessible, 'invalid', { isAccessible: false, isOpen: false }],
    ['open state with invalid value', STORAGE_KEYS.open, 'invalid', { isAccessible: false, isOpen: false }],
  ])('should load %s from local storage', (_name, key, value, expectedState) => {
    window.localStorage.setItem(key, value);
    renderProvider();

    expectState(expectedState);
  });

  it('should force accessibility and open state when featureControl query param is true', () => {
    locationServiceMock.getSearchObject.mockReturnValue({ featureControl: true });
    renderProvider();

    expectState({ isAccessible: true, isOpen: true });
    expectStorage({ isAccessible: 'true', isOpen: 'true' });
  });

  it('should update accessibility and open state', async () => {
    renderProvider();

    await userEvent.click(screen.getByText('Enable accessibility'));
    await userEvent.click(screen.getByText('Open feature control'));

    expectState({ isAccessible: true, isOpen: true });
    expectStorage({ isAccessible: 'true', isOpen: 'true' });
  });
});
