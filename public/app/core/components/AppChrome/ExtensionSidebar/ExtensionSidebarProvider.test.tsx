import { render, screen, act } from '@testing-library/react';
// import { render } from 'test/test-utils';

import { store } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';

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
  beforeEach(() => {
    jest.clearAllMocks();
    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(new Map([[mockPluginMeta.pluginId, mockPluginMeta]]));
    jest.replaceProperty(config.featureToggles, 'extensionSidebar', true);
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
