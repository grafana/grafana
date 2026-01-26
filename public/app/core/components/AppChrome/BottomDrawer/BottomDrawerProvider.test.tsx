import { render, screen, act } from '@testing-library/react';
import { useAsync } from 'react-use';

import { store, EventBusSrv, EventBus, ExtensionInfo } from '@grafana/data';
import { config, getAppEvents, setAppEvents, locationService } from '@grafana/runtime';
import { OpenBottomDrawerEvent, CloseBottomDrawerEvent, ToggleBottomDrawerEvent } from 'app/types/events';

import {
  BottomDrawerContextProvider,
  useBottomDrawerContext,
  getComponentIdFromComponentMeta,
  getComponentMetaFromComponentId,
  BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY,
} from './BottomDrawerProvider';

const mockComponent = {
  title: 'Test Component',
  description: 'Test Description',
  targets: [],
} as ExtensionInfo;

const mockDifferentComponent = {
  title: 'Different Component',
  description: 'Different Description',
  targets: [],
} as ExtensionInfo;

const mockPluginMeta = {
  pluginId: 'grafana-coda-app',
  addedComponents: [mockComponent, mockDifferentComponent],
  addedLinks: [],
};

// Mock the store
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  store: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      bottomDrawer: true,
    },
  },
  locationService: {
    getLocation: jest.fn().mockReturnValue({ pathname: '/test-path' }),
    getLocationObservable: jest.fn(),
  },
  usePluginLinks: jest.fn().mockImplementation(() => ({
    links: [
      {
        pluginId: mockPluginMeta.pluginId,
        title: mockComponent.title,
      },
    ],
    isLoading: false,
  })),
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: jest.fn(),
}));

describe('BottomDrawerProvider', () => {
  let subscribeSpy: jest.SpyInstance;
  let originalAppEvents: EventBus;
  let mockEventBus: EventBusSrv;
  let locationObservableMock: { callback: jest.Mock | null; subscribe: jest.Mock };
  const useAsyncMock = jest.mocked(useAsync);

  beforeEach(() => {
    jest.clearAllMocks();

    originalAppEvents = getAppEvents();

    mockEventBus = new EventBusSrv();
    subscribeSpy = jest.spyOn(mockEventBus, 'subscribe');

    setAppEvents(mockEventBus);

    useAsyncMock.mockReturnValue({ loading: false, value: new Map([[mockPluginMeta.pluginId, mockPluginMeta]]) });

    locationObservableMock = {
      subscribe: jest.fn((callback) => {
        locationObservableMock.callback = callback;
        return {
          unsubscribe: jest.fn(),
        };
      }),
      callback: null,
    };
    (locationService.getLocationObservable as jest.Mock).mockReturnValue(locationObservableMock);

    (store.get as jest.Mock).mockReturnValue(undefined);
    (store.set as jest.Mock).mockImplementation(() => {});
    (store.delete as jest.Mock).mockImplementation(() => {});

    // Enable the feature flag by default
    (config.featureToggles as Record<string, boolean>).bottomDrawer = true;
  });

  afterEach(() => {
    setAppEvents(originalAppEvents);
  });

  const TestComponent = () => {
    const context = useBottomDrawerContext();
    return (
      <div>
        <div data-testid="is-open">{context.isOpen.toString()}</div>
        <div data-testid="docked-component-id">{context.dockedComponentId || 'undefined'}</div>
        <div data-testid="available-components-size">{context.availableComponents.size}</div>
        <div data-testid="plugin-ids">{Array.from(context.availableComponents.keys()).join(', ')}</div>
      </div>
    );
  };

  describe('Feature Flag', () => {
    it('should render disabled context when feature flag is off', () => {
      (config.featureToggles as Record<string, boolean>).bottomDrawer = false;

      render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
      expect(screen.getByTestId('available-components-size')).toHaveTextContent('0');
    });

    it('should render full provider when feature flag is on', () => {
      (config.featureToggles as Record<string, boolean>).bottomDrawer = true;

      render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      expect(screen.getByTestId('available-components-size')).toHaveTextContent('1');
    });
  });

  describe('Provider Context', () => {
    it('should provide default context values', () => {
      render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
      expect(screen.getByTestId('available-components-size')).toHaveTextContent('1');
    });

    it('should load docked component from storage if available', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);
      (store.get as jest.Mock).mockReturnValue(componentId);

      render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      expect(screen.getByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent(componentId);
    });

    it('should update storage when docked component changes', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);

      const TestComponentWithActions = () => {
        const context = useBottomDrawerContext();
        return (
          <div>
            <button
              onClick={() => {
                context.setDockedComponentId(componentId);
              }}
            >
              Set Component
            </button>
            <button
              onClick={() => {
                context.setDockedComponentId(undefined);
              }}
            >
              Clear Component
            </button>
          </div>
        );
      };

      render(
        <BottomDrawerContextProvider>
          <TestComponentWithActions />
        </BottomDrawerContextProvider>
      );

      act(() => {
        screen.getByText('Set Component').click();
      });

      expect(store.set).toHaveBeenCalledWith(BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY, componentId);

      act(() => {
        screen.getByText('Clear Component').click();
      });

      expect(store.delete).toHaveBeenCalledWith(BOTTOM_DRAWER_DOCKED_LOCAL_STORAGE_KEY);
    });

    it('should only include permitted plugins in available components', () => {
      const permittedPluginMeta = {
        pluginId: 'grafana-coda-app',
        addedComponents: [mockComponent],
        addedLinks: [],
      };

      const prohibitedPluginMeta = {
        pluginId: 'disabled-plugin',
        addedComponents: [mockComponent],
        addedLinks: [],
      };

      useAsyncMock.mockReturnValue({
        loading: false,
        value: new Map([
          [permittedPluginMeta.pluginId, permittedPluginMeta],
          [prohibitedPluginMeta.pluginId, prohibitedPluginMeta],
        ]),
      });

      render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      // Should only include the permitted plugin
      expect(screen.getByTestId('available-components-size')).toHaveTextContent('1');
      expect(screen.getByTestId('plugin-ids')).toHaveTextContent(permittedPluginMeta.pluginId);
    });
  });

  describe('Event Handling', () => {
    it('should subscribe to OpenBottomDrawerEvent, CloseBottomDrawerEvent, and ToggleBottomDrawerEvent', () => {
      render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      expect(subscribeSpy).toHaveBeenCalledWith(OpenBottomDrawerEvent, expect.any(Function));
      expect(subscribeSpy).toHaveBeenCalledWith(CloseBottomDrawerEvent, expect.any(Function));
      expect(subscribeSpy).toHaveBeenCalledWith(ToggleBottomDrawerEvent, expect.any(Function));
    });

    it('should set dockedComponentId and props when receiving a valid OpenBottomDrawerEvent', () => {
      const TestComponentWithProps = () => {
        const context = useBottomDrawerContext();
        return (
          <div>
            <div data-testid="is-open">{context.isOpen.toString()}</div>
            <div data-testid="docked-component-id">{context.dockedComponentId || 'undefined'}</div>
            <div data-testid="props">{context.props ? JSON.stringify(context.props) : 'undefined'}</div>
          </div>
        );
      };

      render(
        <BottomDrawerContextProvider>
          <TestComponentWithProps />
        </BottomDrawerContextProvider>
      );

      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
      expect(screen.getByTestId('props')).toHaveTextContent('undefined');

      expect(subscribeSpy).toHaveBeenCalledWith(OpenBottomDrawerEvent, expect.any(Function));
      act(() => {
        // Get the event subscriber function
        const [[, subscriberFn]] = subscribeSpy.mock.calls;

        // Call it directly with the test event
        subscriberFn(
          new OpenBottomDrawerEvent({
            pluginId: 'grafana-coda-app',
            componentTitle: 'Test Component',
            props: { testProp: 'test value' },
          })
        );
      });

      expect(screen.getByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByTestId('props')).toHaveTextContent('{"testProp":"test value"}');
      const expectedComponentId = JSON.stringify({
        pluginId: 'grafana-coda-app',
        componentTitle: 'Test Component',
      });
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent(expectedComponentId);
    });

    it('should not open drawer when receiving an OpenBottomDrawerEvent with non-permitted plugin', () => {
      render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      expect(screen.getByTestId('is-open')).toHaveTextContent('false');

      act(() => {
        // Get the event subscriber function
        const [[, subscriberFn]] = subscribeSpy.mock.calls;

        // Call it directly with the test event for a non-permitted plugin
        subscriberFn(
          new OpenBottomDrawerEvent({
            pluginId: 'non-permitted-plugin',
            componentTitle: 'Test Component',
          })
        );
      });

      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    });

    it('should close drawer when receiving a CloseBottomDrawerEvent', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);

      const TestComponentWithProps = () => {
        const context = useBottomDrawerContext();
        return (
          <div>
            <div data-testid="is-open">{context.isOpen.toString()}</div>
            <div data-testid="docked-component-id">{context.dockedComponentId || 'undefined'}</div>
            <button onClick={() => context.setDockedComponentId(componentId)}>Open Drawer</button>
          </div>
        );
      };

      render(
        <BottomDrawerContextProvider>
          <TestComponentWithProps />
        </BottomDrawerContextProvider>
      );

      // First open the drawer manually
      act(() => {
        screen.getByText('Open Drawer').click();
      });

      expect(screen.getByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent(componentId);

      // Now test the close event
      act(() => {
        // Find the CloseBottomDrawerEvent subscriber
        const closeEventSubscriberCall = subscribeSpy.mock.calls.find((call) => call[0] === CloseBottomDrawerEvent);

        expect(closeEventSubscriberCall).toBeDefined();
        const [, subscriberFn] = closeEventSubscriberCall!;

        // Call the close event handler
        subscriberFn(new CloseBottomDrawerEvent());
      });

      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
    });

    it('should toggle drawer when receiving ToggleBottomDrawerEvent', () => {
      const TestComponentWithProps = () => {
        const context = useBottomDrawerContext();
        return (
          <div>
            <div data-testid="is-open">{context.isOpen.toString()}</div>
            <div data-testid="docked-component-id">{context.dockedComponentId || 'undefined'}</div>
            <div data-testid="props">{context.props ? JSON.stringify(context.props) : 'undefined'}</div>
          </div>
        );
      };

      render(
        <BottomDrawerContextProvider>
          <TestComponentWithProps />
        </BottomDrawerContextProvider>
      );

      // Drawer is closed
      expect(screen.getByTestId('is-open')).toHaveTextContent('false');

      // Toggle the drawer to open it
      act(() => {
        // Call the toggle event handler
        const toggleEventSubscriberCall = subscribeSpy.mock.calls.find((call) => call[0] === ToggleBottomDrawerEvent);
        expect(toggleEventSubscriberCall).toBeDefined();
        const [, subscriberFn] = toggleEventSubscriberCall!;

        subscriberFn(
          new ToggleBottomDrawerEvent({
            pluginId: 'grafana-coda-app',
            componentTitle: 'Test Component',
            props: { testProp: 'test value' },
          })
        );
      });

      // Drawer is open
      expect(screen.getByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByTestId('props')).toHaveTextContent('{"testProp":"test value"}');
      const expectedComponentId = JSON.stringify({
        pluginId: 'grafana-coda-app',
        componentTitle: 'Test Component',
      });
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent(expectedComponentId);

      // Toggle the drawer to close it
      act(() => {
        // Call the toggle event handler
        const toggleEventSubscriberCall = subscribeSpy.mock.calls
          .slice()
          .reverse()
          .find((call) => call[0] === ToggleBottomDrawerEvent);
        expect(toggleEventSubscriberCall).toBeDefined();
        const [, subscriberFn] = toggleEventSubscriberCall!;

        subscriberFn(
          new ToggleBottomDrawerEvent({
            pluginId: mockPluginMeta.pluginId,
            componentTitle: mockComponent.title,
          })
        );
      });

      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
      expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
    });

    it('should unsubscribe from all event subscriptions on unmount', () => {
      const unsubscribeMocks = [jest.fn(), jest.fn(), jest.fn()];
      let callIndex = 0;

      subscribeSpy.mockImplementation(() => ({
        unsubscribe: unsubscribeMocks[callIndex++],
      }));

      const { unmount } = render(
        <BottomDrawerContextProvider>
          <TestComponent />
        </BottomDrawerContextProvider>
      );

      unmount();

      // All event subscriptions should be unsubscribed
      expect(unsubscribeMocks[0]).toHaveBeenCalled();
      expect(unsubscribeMocks[1]).toHaveBeenCalled();
      expect(unsubscribeMocks[2]).toHaveBeenCalled();
    });
  });
});

describe('Utility Functions', () => {
  describe('getComponentIdFromComponentMeta', () => {
    it('should create a valid component ID', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);

      expect(componentId).toBe(
        JSON.stringify({ pluginId: mockPluginMeta.pluginId, componentTitle: mockComponent.title })
      );
    });
  });

  describe('getComponentMetaFromComponentId', () => {
    it('should parse a valid component ID', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);

      const meta = getComponentMetaFromComponentId(componentId);
      expect(meta).toEqual({
        pluginId: mockPluginMeta.pluginId,
        componentTitle: mockComponent.title,
      });
    });

    it('should return undefined for invalid JSON', () => {
      const meta = getComponentMetaFromComponentId('invalid-json');
      expect(meta).toBeUndefined();
    });

    it('should return undefined for missing required fields', () => {
      const meta = getComponentMetaFromComponentId(JSON.stringify({ pluginId: mockPluginMeta.pluginId }));
      expect(meta).toBeUndefined();
    });

    it('should return undefined for wrong field types', () => {
      const meta = getComponentMetaFromComponentId(JSON.stringify({ pluginId: 123, componentTitle: 'Test Component' }));
      expect(meta).toBeUndefined();
    });
  });
});
