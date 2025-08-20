import { render, screen, act } from '@testing-library/react';

import { store, EventBusSrv, EventBus } from '@grafana/data';
import { config, getAppEvents, setAppEvents, locationService } from '@grafana/runtime';
import { getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';
import { OpenExtensionSidebarEvent, CloseExtensionSidebarEvent } from 'app/types/events';

import {
  ExtensionSidebarContextProvider,
  useExtensionSidebarContext,
  getComponentIdFromComponentMeta,
  getComponentMetaFromComponentId,
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
} from './ExtensionSidebarProvider';

const mockComponent = {
  title: 'Test Component',
  description: 'Test Description',
  targets: [],
};

const mockPluginMeta = {
  pluginId: 'grafana-investigations-app',
  addedComponents: [mockComponent],
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

// Mock the extension point plugin meta
jest.mock('app/features/plugins/extensions/utils', () => ({
  ...jest.requireActual('app/features/plugins/extensions/utils'),
  getExtensionPointPluginMeta: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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
  })),
}));

describe('ExtensionSidebarProvider', () => {
  let subscribeSpy: jest.SpyInstance;
  let originalAppEvents: EventBus;
  let mockEventBus: EventBusSrv;
  let locationObservableMock: { callback: jest.Mock | null; subscribe: jest.Mock };
  const getExtensionPointPluginMetaMock = jest.mocked(getExtensionPointPluginMeta);

  beforeEach(() => {
    jest.clearAllMocks();

    originalAppEvents = getAppEvents();

    mockEventBus = new EventBusSrv();
    subscribeSpy = jest.spyOn(mockEventBus, 'subscribe');

    setAppEvents(mockEventBus);

    getExtensionPointPluginMetaMock.mockReturnValue(new Map([[mockPluginMeta.pluginId, mockPluginMeta]]));

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
  });

  afterEach(() => {
    setAppEvents(originalAppEvents);
  });

  const TestComponent = () => {
    const context = useExtensionSidebarContext();
    return (
      <div>
        <div data-testid="is-open">{context.isOpen.toString()}</div>
        <div data-testid="docked-component-id">{context.dockedComponentId || 'undefined'}</div>
        <div data-testid="available-components-size">{context.availableComponents.size}</div>
        <div data-testid="plugin-ids">{Array.from(context.availableComponents.keys()).join(', ')}</div>
      </div>
    );
  };

  it('should provide default context values', () => {
    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
    expect(screen.getByTestId('available-components-size')).toHaveTextContent('1');
    expect(screen.getByTestId('is-enabled')).toHaveTextContent('true');
  });

  it('should load docked component from storage if available', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent);
    (store.get as jest.Mock).mockReturnValue(componentId);

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(componentId);
  });

  it('should update storage when docked component changes', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent);

    const TestComponentWithActions = () => {
      const context = useExtensionSidebarContext();
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
      <ExtensionSidebarContextProvider>
        <TestComponentWithActions />
      </ExtensionSidebarContextProvider>
    );

    act(() => {
      screen.getByText('Set Component').click();
    });

    expect(store.set).toHaveBeenCalledWith(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY, componentId);

    act(() => {
      screen.getByText('Clear Component').click();
    });

    expect(store.delete).toHaveBeenCalledWith(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  });

  it('should only include permitted plugins in available components', () => {
    const permittedPluginMeta = {
      pluginId: 'grafana-investigations-app',
      addedComponents: [mockComponent],
      addedLinks: [],
    };

    const prohibitedPluginMeta = {
      pluginId: 'disabled-plugin',
      addedComponents: [mockComponent],
      addedLinks: [],
    };

    getExtensionPointPluginMetaMock.mockReturnValue(
      new Map([
        [permittedPluginMeta.pluginId, permittedPluginMeta],
        [prohibitedPluginMeta.pluginId, prohibitedPluginMeta],
      ])
    );

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    // Should only include the enabled plugin
    expect(screen.getByTestId('available-components-size')).toHaveTextContent('1');
    expect(screen.getByTestId('plugin-ids')).toHaveTextContent(permittedPluginMeta.pluginId);
  });

  it('should subscribe to OpenExtensionSidebarEvent and CloseExtensionSidebarEvent when feature is enabled', async () => {
    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(subscribeSpy).toHaveBeenCalledWith(OpenExtensionSidebarEvent, expect.any(Function));
    expect(subscribeSpy).toHaveBeenCalledWith(CloseExtensionSidebarEvent, expect.any(Function));
  });

  it('should set dockedComponentId and props when receiving a valid OpenExtensionSidebarEvent', () => {
    const TestComponentWithProps = () => {
      const context = useExtensionSidebarContext();
      return (
        <div>
          <div data-testid="is-open">{context.isOpen.toString()}</div>
          <div data-testid="docked-component-id">{context.dockedComponentId || 'undefined'}</div>
          <div data-testid="props">{context.props ? JSON.stringify(context.props) : 'undefined'}</div>
        </div>
      );
    };

    render(
      <ExtensionSidebarContextProvider>
        <TestComponentWithProps />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('props')).toHaveTextContent('undefined');

    expect(subscribeSpy).toHaveBeenCalledWith(OpenExtensionSidebarEvent, expect.any(Function));
    act(() => {
      // Get the event subscriber function
      const [[, subscriberFn]] = subscribeSpy.mock.calls;

      // Call it directly with the test event
      subscriberFn(
        new OpenExtensionSidebarEvent({
          pluginId: 'grafana-investigations-app',
          componentTitle: 'Test Component',
          props: { testProp: 'test value' },
        })
      );
    });

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('props')).toHaveTextContent('{"testProp":"test value"}');
    const expectedComponentId = JSON.stringify({
      pluginId: 'grafana-investigations-app',
      componentTitle: 'Test Component',
    });
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(expectedComponentId);
  });

  it('should not open sidebar when receiving an OpenExtensionSidebarEvent with non-permitted plugin', () => {
    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');

    act(() => {
      // Get the event subscriber function
      const [[, subscriberFn]] = subscribeSpy.mock.calls;

      // Call it directly with the test event for a non-permitted plugin
      subscriberFn(
        new OpenExtensionSidebarEvent({
          pluginId: 'non-permitted-plugin',
          componentTitle: 'Test Component',
        })
      );
    });

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should close sidebar when receiving a CloseExtensionSidebarEvent', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent);

    const TestComponentWithProps = () => {
      const context = useExtensionSidebarContext();
      return (
        <div>
          <div data-testid="is-open">{context.isOpen.toString()}</div>
          <div data-testid="docked-component-id">{context.dockedComponentId || 'undefined'}</div>
          <button onClick={() => context.setDockedComponentId(componentId)}>Open Sidebar</button>
        </div>
      );
    };

    render(
      <ExtensionSidebarContextProvider>
        <TestComponentWithProps />
      </ExtensionSidebarContextProvider>
    );

    // First open the sidebar manually
    act(() => {
      screen.getByText('Open Sidebar').click();
    });

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(componentId);

    // Now test the close event
    act(() => {
      // Find the CloseExtensionSidebarEvent subscriber
      const closeEventSubscriberCall = subscribeSpy.mock.calls.find((call) => call[0] === CloseExtensionSidebarEvent);

      expect(closeEventSubscriberCall).toBeDefined();
      const [, subscriberFn] = closeEventSubscriberCall!;

      // Call the close event handler
      subscriberFn(new CloseExtensionSidebarEvent());
    });

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
  });

  it('should unsubscribe from both OpenExtensionSidebarEvent and CloseExtensionSidebarEvent on unmount', () => {
    const unsubscribeMocks = [jest.fn(), jest.fn()];
    let callIndex = 0;

    subscribeSpy.mockImplementation(() => ({
      unsubscribe: unsubscribeMocks[callIndex++],
    }));

    const { unmount } = render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    unmount();

    // Both event subscriptions should be unsubscribed
    expect(unsubscribeMocks[0]).toHaveBeenCalled();
    expect(unsubscribeMocks[1]).toHaveBeenCalled();
  });

  it('should subscribe to location service observable', () => {
    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(locationService.getLocationObservable).toHaveBeenCalled();
    expect(locationObservableMock.subscribe).toHaveBeenCalled();
  });

  it('should update current path when location changes', () => {
    const usePluginLinksMock = jest.fn().mockReturnValue({ links: [] });
    jest.requireMock('@grafana/runtime').usePluginLinks = usePluginLinksMock;

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(usePluginLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          path: '/test-path',
        }),
      })
    );

    act(() => {
      locationObservableMock.callback?.({ pathname: '/new-path' });
    });

    expect(usePluginLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          path: '/new-path',
        }),
      })
    );
  });

  it('should unsubscribe from location service on unmount', () => {
    const unsubscribeMock = jest.fn();
    locationObservableMock.subscribe.mockReturnValue({
      unsubscribe: unsubscribeMock,
    });

    const { unmount } = render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('should not include plugins in available components when no links are returned', () => {
    jest.requireMock('@grafana/runtime').usePluginLinks.mockImplementation(() => ({
      links: [],
    }));

    getExtensionPointPluginMetaMock.mockReturnValue(new Map([[mockPluginMeta.pluginId, mockPluginMeta]]));

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('available-components-size')).toHaveTextContent('0');
  });
});

describe('Utility Functions', () => {
  describe('getComponentIdFromComponentMeta', () => {
    it('should create a valid component ID', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent);

      expect(componentId).toBe(
        JSON.stringify({ pluginId: mockPluginMeta.pluginId, componentTitle: mockComponent.title })
      );
    });
  });

  describe('getComponentMetaFromComponentId', () => {
    it('should parse a valid component ID', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent);

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
