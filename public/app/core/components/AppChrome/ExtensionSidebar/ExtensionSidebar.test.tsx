import { render, screen } from '@testing-library/react';

import { ExtensionInfo, PluginExtensionTypes } from '@grafana/data';
import { config, usePluginComponents } from '@grafana/runtime';
import { AddedComponentRegistryItem } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { ExtensionSidebar } from './ExtensionSidebar';
import {
  ExtensionSidebarContextType,
  getComponentIdFromComponentMeta,
  useExtensionSidebarContext,
} from './ExtensionSidebarProvider';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

jest.mock('./ExtensionSidebarProvider', () => ({
  ...jest.requireActual('./ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

const mockUsePluginComponents = jest.mocked(usePluginComponents);
const mockUseExtensionSidebarContext = jest.mocked(useExtensionSidebarContext);

const MockComponent = () => <div data-testid="working-component">Mock Component</div>;
const pluginId = 'test-plugin';
const extensionPointId = 'grafana/extension-sidebar/v0-alpha';

MockComponent.meta = {
  pluginId,
  title: 'Test Component',
  id: 'test-component-id',
  type: PluginExtensionTypes.component,
  description: 'Test Component',
};

const addedComponentConfigMock: ExtensionInfo = {
  targets: extensionPointId,
  title: 'Test Component',
};

const extensionSidebarContextMock: ExtensionSidebarContextType = {
  dockedComponentId: getComponentIdFromComponentMeta(pluginId, addedComponentConfigMock),
  props: {},
  isOpen: true,
  setDockedComponentId: jest.fn(),
  availableComponents: new Map(),
  extensionSidebarWidth: 300,
  setExtensionSidebarWidth: jest.fn(),
};

const addedComponentRegistryItemMock: AddedComponentRegistryItem = {
  pluginId,
  title: addedComponentConfigMock.title,
  component: MockComponent,
};

describe('ExtensionSidebar', () => {
  const originalEnv = config.buildInfo.env;

  beforeEach(() => {
    jest.clearAllMocks();
    config.buildInfo.env = 'development';
  });

  afterEach(() => {
    config.buildInfo.env = originalEnv;
  });

  it('should render nothing when the extension sidebar is enabled but no component is docked', () => {
    mockUseExtensionSidebarContext.mockReturnValue({
      ...extensionSidebarContextMock,
      dockedComponentId: undefined,
    });

    mockUsePluginComponents.mockReturnValue({
      components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
      isLoading: false,
    });

    const { container } = render(<ExtensionSidebar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when the extension sidebar is enabled but the component docked is not found in the available components', () => {
    mockUseExtensionSidebarContext.mockReturnValue({
      ...extensionSidebarContextMock,
      dockedComponentId: 'test-component-id-not-found',
    });

    mockUsePluginComponents.mockReturnValue({
      components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
      isLoading: false,
    });

    const { container } = render(<ExtensionSidebar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when the extension sidebar is enabled but the component docked is not found in the available components', () => {
    mockUseExtensionSidebarContext.mockReturnValue({
      ...extensionSidebarContextMock,
      dockedComponentId: 'test-component-id-not-found',
    });

    mockUsePluginComponents.mockReturnValue({
      components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
      isLoading: false,
    });

    const { container } = render(<ExtensionSidebar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when components are loading', () => {
    mockUseExtensionSidebarContext.mockReturnValue({
      ...extensionSidebarContextMock,
    });

    mockUsePluginComponents.mockReturnValue({
      components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
      isLoading: true,
    });

    const { container } = render(<ExtensionSidebar />);
    expect(container.firstChild).toBeNull();
  });

  it('should render the component when all conditions are met', () => {
    mockUseExtensionSidebarContext.mockReturnValue({
      ...extensionSidebarContextMock,
    });

    mockUsePluginComponents.mockReturnValue({
      components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
      isLoading: false,
    });

    const { container } = render(<ExtensionSidebar />);
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('Mock Component')).toBeInTheDocument();
  });
});
