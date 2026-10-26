import { render, screen } from '@testing-library/react';

import { type ExtensionInfo, PluginExtensionTypes } from '@grafana/data';
import { config, usePluginComponents } from '@grafana/runtime';
import { type AddedComponentRegistryItem } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { ExtensionSidebar } from './ExtensionSidebar';
import { type ExtensionSidebarContextType, useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { setExtensionSidebarPresentation } from './extensionSidebarLayout';
import { getComponentIdFromComponentMeta } from './extensionSidebarUtils';
import { useFloatingDrag } from './useFloatingDrag';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

jest.mock('./ExtensionSidebarProvider', () => ({
  ...jest.requireActual('./ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

jest.mock('./extensionSidebarLayout', () => ({
  ...jest.requireActual('./extensionSidebarLayout'),
  setExtensionSidebarPresentation: jest.fn(),
}));

jest.mock('./useFloatingDrag', () => ({
  ...jest.requireActual('./useFloatingDrag'),
  useFloatingDrag: jest.fn(),
}));

const mockUsePluginComponents = jest.mocked(usePluginComponents);
const mockUseExtensionSidebarContext = jest.mocked(useExtensionSidebarContext);
const mockUseFloatingDrag = jest.mocked(useFloatingDrag);

const MockComponent = ({ extensionSidebarPresentation }: { extensionSidebarPresentation?: string }) => (
  <div data-testid="working-component" data-presentation={extensionSidebarPresentation}>
    Mock Component
  </div>
);
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
  dockedComponentId: getComponentIdFromComponentMeta(pluginId, addedComponentConfigMock.title),
  props: {},
  isOpen: true,
  setDockedComponentId: jest.fn(),
  availableComponents: new Map(),
  extensionSidebarWidth: 300,
  setExtensionSidebarWidth: jest.fn(),
  floatingExtensionSidebarWidth: 480,
  setFloatingExtensionSidebarWidth: jest.fn(),
  presentation: 'docked',
  floatingHidden: false,
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
    mockUseFloatingDrag.mockReturnValue(null);
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

  it('tells the extension its presentation without remounting it', () => {
    mockUsePluginComponents.mockReturnValue({
      components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
      isLoading: false,
    });
    mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'floating' });

    const { rerender } = render(<ExtensionSidebar />);
    const component = screen.getByTestId('working-component');
    expect(component).toHaveAttribute('data-presentation', 'floating');

    mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'docked' });
    rerender(<ExtensionSidebar />);
    expect(screen.getByTestId('working-component')).toBe(component);
    expect(component).toHaveAttribute('data-presentation', 'docked');
  });

  describe('while floating', () => {
    beforeEach(() => {
      mockUsePluginComponents.mockReturnValue({
        components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
        isLoading: false,
      });
      mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'floating' });
    });

    it('puts the width handle on the moved sidebar, never on the docked one', () => {
      const { container, rerender } = render(<ExtensionSidebar />);
      expect(screen.getByRole('separator', { name: 'Resize sidebar width' }).parentElement).toBe(container.firstChild);

      mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'docked' });
      rerender(<ExtensionSidebar />);
      expect(screen.queryByRole('separator', { name: 'Resize sidebar width' })).not.toBeInTheDocument();
    });

    it('docks when the drag asks it to', () => {
      render(<ExtensionSidebar />);

      mockUseFloatingDrag.mock.lastCall?.[1].onDock();

      expect(setExtensionSidebarPresentation).toHaveBeenCalledWith('docked');
    });

    it('shows the dock preview over the page, with its top-right corner square', () => {
      mockUseFloatingDrag.mockReturnValue({ action: 'dock', top: 0, left: 700, width: 300, height: 768 });

      render(<ExtensionSidebar />);

      const preview = screen.getByTestId('extension-sidebar-dock-preview');
      expect(preview.parentElement).toBe(document.body);
      expect(preview).toHaveStyle({
        top: '0px',
        left: '700px',
        width: '300px',
        height: '768px',
        borderTopRightRadius: '0',
      });
    });

    it('shows the collapse preview where the drag puts it', () => {
      mockUseFloatingDrag.mockReturnValue({ action: 'collapse', top: 700, left: 300, width: 400, height: 56 });

      render(<ExtensionSidebar />);

      expect(screen.getByTestId('extension-sidebar-collapse-preview')).toHaveStyle({
        top: '700px',
        left: '300px',
        width: '400px',
        height: '56px',
      });
    });
  });
});
