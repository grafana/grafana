import { render, screen, act } from '@testing-library/react';
import { useAsync } from 'react-use';

import {
  store,
  EventBusSrv,
  type EventBus,
  type ExtensionInfo,
  type PluginExtensionComponentMeta,
  PluginExtensionTypes,
} from '@grafana/data';
import { getAppEvents, setAppEvents, locationService, usePluginComponents } from '@grafana/runtime';
import { OpenExtensionSidebarEvent, CloseExtensionSidebarEvent, ToggleExtensionSidebarEvent } from 'app/types/events';

import { ExtensionSidebarContextProvider, useExtensionSidebarContext } from './ExtensionSidebarProvider';
import {
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
  EXTENSION_SIDEBAR_URL_PARAM,
  getComponentIdFromComponentMeta,
  getComponentIdFromUrlValue,
  getComponentMetaFromComponentId,
  getComponentUrlValue,
} from './extensionSidebarUtils';

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
  pluginId: 'grafana-assistant-app',
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
    getObject: jest.fn().mockImplementation((_key: string, defaultValue: unknown) => defaultValue),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getLocation: jest.fn().mockReturnValue({ pathname: '/test-path' }),
    getLocationObservable: jest.fn(),
    getSearchObject: jest.fn().mockReturnValue({}),
    partial: jest.fn(),
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
  usePluginComponents: jest.fn(() => ({ components: [], isLoading: false })),
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: jest.fn(),
}));

describe('ExtensionSidebarProvider', () => {
  let subscribeSpy: jest.SpyInstance;
  let originalAppEvents: EventBus;
  let mockEventBus: EventBusSrv;
  let locationObservableMock: { callback: jest.Mock | null; subscribe: jest.Mock };
  const useAsyncMock = jest.mocked(useAsync);
  const usePluginComponentsMock = jest.mocked(usePluginComponents);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock('@grafana/runtime').usePluginLinks.mockImplementation(() => ({
      links: [
        {
          pluginId: mockPluginMeta.pluginId,
          title: mockComponent.title,
        },
      ],
      isLoading: false,
    }));
    usePluginComponentsMock.mockReturnValue({ components: [], isLoading: false });
    (locationService.getSearchObject as jest.Mock).mockReturnValue({});

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
  });

  it('should load docked component from storage if available', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);
    (store.get as jest.Mock).mockReturnValue(componentId);

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(componentId);
  });

  it('should load a docked component from the URL', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);
    (locationService.getSearchObject as jest.Mock).mockReturnValue({
      [EXTENSION_SIDEBAR_URL_PARAM]: getComponentUrlValue(componentId),
    });

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(componentId);
    expect(locationService.partial).not.toHaveBeenCalled();
  });

  it('should restore the URL state when navigation keeps an available sidebar open', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);
    let searchObject: Record<string, string> = {
      [EXTENSION_SIDEBAR_URL_PARAM]: getComponentUrlValue(componentId)!,
    };
    (locationService.getSearchObject as jest.Mock).mockImplementation(() => searchObject);

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    jest.mocked(locationService.partial).mockClear();
    searchObject = {};
    act(() => {
      locationObservableMock.callback?.({ pathname: '/new-path' });
    });

    expect(locationService.partial).toHaveBeenCalledWith(
      { [EXTENSION_SIDEBAR_URL_PARAM]: `${mockPluginMeta.pluginId}/${mockComponent.title}` },
      true
    );
  });

  it('should update storage when docked component changes', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);

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
    expect(locationService.partial).toHaveBeenCalledWith(
      { [EXTENSION_SIDEBAR_URL_PARAM]: `${mockPluginMeta.pluginId}/${mockComponent.title}` },
      true
    );

    act(() => {
      screen.getByText('Clear Component').click();
    });

    expect(store.delete).toHaveBeenCalledWith(EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY);
  });

  it('should only include permitted plugins in available components', () => {
    const permittedPluginMeta = {
      pluginId: 'grafana-assistant-app',
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
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    // Should only include the enabled plugin
    expect(screen.getByTestId('available-components-size')).toHaveTextContent('1');
    expect(screen.getByTestId('plugin-ids')).toHaveTextContent(permittedPluginMeta.pluginId);
  });

  it('should allow a matching core Grafana component', () => {
    const coreComponentMeta: PluginExtensionComponentMeta = {
      pluginId: 'grafana',
      title: mockComponent.title,
      description: mockComponent.description ?? '',
      id: 'grafana/notebook',
      type: PluginExtensionTypes.component,
    };
    jest.requireMock('@grafana/runtime').usePluginLinks.mockImplementation(() => ({
      links: [{ pluginId: 'grafana', title: mockComponent.title }],
      isLoading: false,
    }));
    usePluginComponentsMock.mockReturnValue({
      components: [
        Object.assign(() => null, {
          meta: coreComponentMeta,
        }),
      ],
      isLoading: false,
    });
    useAsyncMock.mockReturnValue({ loading: false, value: new Map() });

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('plugin-ids')).toHaveTextContent('grafana');
  });

  it('should preserve a URL-selected core component while its registry entry loads', () => {
    const componentId = getComponentIdFromComponentMeta('grafana', mockComponent.title);
    jest.requireMock('@grafana/runtime').usePluginLinks.mockImplementation(() => ({
      links: [{ pluginId: 'grafana', title: mockComponent.title }],
      isLoading: false,
    }));
    (locationService.getSearchObject as jest.Mock).mockReturnValue({
      [EXTENSION_SIDEBAR_URL_PARAM]: getComponentUrlValue(componentId),
    });
    useAsyncMock.mockReturnValue({ loading: false, value: new Map() });

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(componentId);
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
          pluginId: 'grafana-assistant-app',
          componentTitle: 'Test Component',
          props: { testProp: 'test value' },
        })
      );
    });

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('props')).toHaveTextContent('{"testProp":"test value"}');
    const expectedComponentId = JSON.stringify({
      pluginId: 'grafana-assistant-app',
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
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);

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

  it('should subscribe to ToggleExtensionSidebarEvent', () => {
    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(subscribeSpy).toHaveBeenCalledWith(ToggleExtensionSidebarEvent, expect.any(Function));
  });

  it('should toggle sidebar when receiving ToggleExtensionSidebarEvent', () => {
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

    // Sidebar is closed
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');

    // Toggle the sidebar to open it
    act(() => {
      // Call the toggle event handler
      const toggleEventSubscriberCall = subscribeSpy.mock.calls.find((call) => call[0] === ToggleExtensionSidebarEvent);
      expect(toggleEventSubscriberCall).toBeDefined();
      const [, subscriberFn] = toggleEventSubscriberCall!;

      subscriberFn(
        new ToggleExtensionSidebarEvent({
          pluginId: 'grafana-assistant-app',
          componentTitle: 'Test Component',
          props: { testProp: 'test value' },
        })
      );
    });

    // Sidebar is open
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('props')).toHaveTextContent('{"testProp":"test value"}');
    const expectedComponentId = JSON.stringify({
      pluginId: 'grafana-assistant-app',
      componentTitle: 'Test Component',
    });
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(expectedComponentId);

    // Toggle the sidebar to close it
    act(() => {
      // Call the toggle event handler
      const toggleEventSubscriberCall = subscribeSpy.mock.calls
        .slice()
        .reverse()
        .find((call) => call[0] === ToggleExtensionSidebarEvent);
      expect(toggleEventSubscriberCall).toBeDefined();
      const [, subscriberFn] = toggleEventSubscriberCall!;

      subscriberFn(
        new ToggleExtensionSidebarEvent({
          pluginId: mockPluginMeta.pluginId,
          componentTitle: mockComponent.title,
        })
      );
    });

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
  });

  it('should toggle to different component when receiving ToggleExtensionSidebarEvent for different component', () => {
    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);
    (store.get as jest.Mock).mockReturnValue(componentId);

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

    act(() => {
      // Find the ToggleExtensionSidebarEvent subscriber
      const toggleEventSubscriberCall = subscribeSpy.mock.calls
        .slice()
        .reverse()
        .find((call) => call[0] === ToggleExtensionSidebarEvent);
      expect(toggleEventSubscriberCall).toBeDefined();
      const [, subscriberFn] = toggleEventSubscriberCall!;

      // Call the toggle event handler with a different component
      subscriberFn(
        new ToggleExtensionSidebarEvent({
          pluginId: mockPluginMeta.pluginId,
          componentTitle: 'Different Component',
        })
      );
    });

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    const expectedComponentId = JSON.stringify({
      pluginId: mockPluginMeta.pluginId,
      componentTitle: 'Different Component',
    });
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(expectedComponentId);
  });

  it('should unsubscribe from all event subscriptions on unmount', () => {
    const unsubscribeMocks = [jest.fn(), jest.fn(), jest.fn()];
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

    // All event subscriptions should be unsubscribed
    expect(unsubscribeMocks[0]).toHaveBeenCalled();
    expect(unsubscribeMocks[1]).toHaveBeenCalled();
    expect(unsubscribeMocks[2]).toHaveBeenCalled();
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

    useAsyncMock.mockReturnValue({ loading: false, value: new Map([[mockPluginMeta.pluginId, mockPluginMeta]]) });

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

  describe('extension sidebar URL value', () => {
    it('round trips a component ID', () => {
      const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent.title);

      expect(getComponentIdFromUrlValue(getComponentUrlValue(componentId))).toBe(componentId);
    });

    it('rejects an invalid value', () => {
      expect(getComponentIdFromUrlValue('missing-separator')).toBeUndefined();
      expect(getComponentIdFromUrlValue(1)).toBeUndefined();
    });
  });
});
