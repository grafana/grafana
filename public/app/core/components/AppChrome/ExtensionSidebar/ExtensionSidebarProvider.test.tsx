import { render, screen, act } from '@testing-library/react';

import { store, EventBusSrv, EventBus } from '@grafana/data';
import { config, getAppEvents, setAppEvents } from '@grafana/runtime';
import { getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';
import { OpenExtensionSidebarEvent } from 'app/types/events';

import {
  ExtensionSidebarContextProvider,
  useExtensionSidebarContext,
  getComponentIdFromComponentMeta,
  getComponentMetaFromComponentId,
  EXTENSION_SIDEBAR_DOCKED_LOCAL_STORAGE_KEY,
} from './ExtensionSidebarProvider';

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
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      ...jest.requireActual('@grafana/runtime').config.featureToggles,
      extensionSidebar: true,
    },
  },
}));

const mockComponent = {
  title: 'Test Component',
  description: 'Test Description',
  targets: [],
};

const mockPluginMeta = {
  pluginId: 'grafana-investigations-app',
  addedComponents: [mockComponent],
};

describe('ExtensionSidebarProvider', () => {
  let subscribeSpy: jest.SpyInstance;
  let originalAppEvents: EventBus;
  let mockEventBus: EventBusSrv;

  beforeEach(() => {
    jest.clearAllMocks();

    originalAppEvents = getAppEvents();

    mockEventBus = new EventBusSrv();
    subscribeSpy = jest.spyOn(mockEventBus, 'subscribe');

    setAppEvents(mockEventBus);

    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(new Map([[mockPluginMeta.pluginId, mockPluginMeta]]));

    jest.replaceProperty(config.featureToggles, 'extensionSidebar', true);

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
        <div data-testid="is-enabled">{context.isEnabled.toString()}</div>
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

  it('should have empty available components when feature toggle is disabled', () => {
    jest.replaceProperty(config.featureToggles, 'extensionSidebar', false);

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('is-enabled')).toHaveTextContent('false');
    expect(screen.getByTestId('available-components-size')).toHaveTextContent('0');
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

  it('should not load docked component from storage if feature toggle is disabled', () => {
    jest.replaceProperty(config.featureToggles, 'extensionSidebar', false);

    const componentId = getComponentIdFromComponentMeta(mockPluginMeta.pluginId, mockComponent);
    (store.get as jest.Mock).mockReturnValue(componentId);

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent('undefined');
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
    };

    const prohibitedPluginMeta = {
      pluginId: 'disabled-plugin',
      addedComponents: [mockComponent],
    };

    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(
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

  it('should subscribe to OpenExtensionSidebarEvent when feature is enabled', async () => {
    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(subscribeSpy).toHaveBeenCalledWith(OpenExtensionSidebarEvent, expect.any(Function));
  });

  it('should not subscribe to OpenExtensionSidebarEvent when feature is disabled', () => {
    jest.replaceProperty(config.featureToggles, 'extensionSidebar', false);

    render(
      <ExtensionSidebarContextProvider>
        <TestComponent />
      </ExtensionSidebarContextProvider>
    );

    expect(subscribeSpy).not.toHaveBeenCalled();
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

  it('should unsubscribe from OpenExtensionSidebarEvent on unmount', () => {
    const unsubscribeMock = jest.fn();
    subscribeSpy.mockReturnValue({
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
