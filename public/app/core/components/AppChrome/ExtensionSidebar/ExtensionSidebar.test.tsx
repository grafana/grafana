import { render, screen } from '@testing-library/react';

import { createTheme, type ExtensionInfo, PluginExtensionTypes, ThemeContext } from '@grafana/data';
import { config, usePluginComponents } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/feature-flags';
import { type AddedComponentRegistryItem } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { ExtensionSidebar } from './ExtensionSidebar';
import { type ExtensionSidebarContextType, useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { setExtensionSidebarDockSide, setExtensionSidebarPresentation } from './extensionSidebarLayout';
import { getComponentIdFromComponentMeta } from './extensionSidebarUtils';
import { useDockedDrag, useFloatingDrag } from './useFloatingDrag';

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
  setExtensionSidebarDockSide: jest.fn(),
}));

jest.mock('./useFloatingDrag', () => ({
  ...jest.requireActual('./useFloatingDrag'),
  useFloatingDrag: jest.fn(),
  useDockedDrag: jest.fn(),
}));

const mockUsePluginComponents = jest.mocked(usePluginComponents);
const mockUseExtensionSidebarContext = jest.mocked(useExtensionSidebarContext);
const mockUseFloatingDrag = jest.mocked(useFloatingDrag);
const mockUseDockedDrag = jest.mocked(useDockedDrag);

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
  extensionSidebarHeight: 320,
  setExtensionSidebarHeight: jest.fn(),
  floatingExtensionSidebarWidth: 480,
  setFloatingExtensionSidebarWidth: jest.fn(),
  presentation: 'docked',
  dockSide: 'right',
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
    mockUseDockedDrag.mockReturnValue(null);
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

    it.each(['left', 'right', 'bottom'] as const)('docks on the %s when the drag asks it to', (side) => {
      render(<ExtensionSidebar />);

      mockUseFloatingDrag.mock.lastCall?.[1].onDock(side);

      expect(setExtensionSidebarDockSide).toHaveBeenCalledWith(side);
      expect(setExtensionSidebarPresentation).toHaveBeenCalledWith('docked');
      // The side is set first, so the sidebar never shows docked on the other one.
      expect(jest.mocked(setExtensionSidebarDockSide).mock.invocationCallOrder[0]).toBeLessThan(
        jest.mocked(setExtensionSidebarPresentation).mock.invocationCallOrder[0]
      );
    });

    it('offers the left and bottom docks only while the sidebar can float', () => {
      render(<ExtensionSidebar />);
      const { canDockLeft, canDockBottom } = mockUseFloatingDrag.mock.lastCall![1];
      expect(canDockLeft()).toBe(false);
      expect(canDockBottom()).toBe(false);

      setTestFlags({ 'grafana.extensionSidebarFloating': true, 'grafana.extensionSidebarPlacements': true });
      expect(canDockLeft()).toBe(true);
      expect(canDockBottom()).toBe(true);
      setTestFlags({});
    });

    it('previews the bottom dock at the height it docks at', () => {
      mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, extensionSidebarHeight: 280 });

      render(<ExtensionSidebar />);

      expect(mockUseFloatingDrag.mock.lastCall?.[1]).toMatchObject({ dockHeight: 280 });
    });

    it('shows the bottom dock preview across the page, below it', () => {
      mockUseFloatingDrag.mockReturnValue({
        action: 'dock',
        side: 'bottom',
        top: 448,
        left: 320,
        width: 704,
        height: 320,
      });

      render(<ExtensionSidebar />);

      const preview = screen.getByTestId('extension-sidebar-dock-preview');
      expect(preview).toHaveStyle({ top: '448px', left: '320px', width: '704px', height: '320px' });
      // Rounded at every corner, as the strip is: no corner meets the window's top.
      expect(preview.style.borderTopLeftRadius).toBe('');
      expect(preview.style.borderTopRightRadius).toBe('');
    });

    it("insets the bottom dock preview as the page's card is, with the visual refresh", () => {
      mockUseFloatingDrag.mockReturnValue({
        action: 'dock',
        side: 'bottom',
        top: 448,
        left: 320,
        width: 704,
        height: 320,
      });

      render(
        <ThemeContext.Provider value={{ ...createTheme(), flags: { visualDesignRefresh: true } }}>
          <ExtensionSidebar />
        </ThemeContext.Provider>
      );

      // 4px in from the page area's left and right edges and from the window's bottom.
      expect(screen.getByTestId('extension-sidebar-dock-preview')).toHaveStyle({
        top: '448px',
        left: '324px',
        width: '696px',
        height: '316px',
      });
    });

    it('shows the left dock preview after the nav, with its top-left corner square', () => {
      mockUseFloatingDrag.mockReturnValue({
        action: 'dock',
        side: 'left',
        top: 80,
        left: 320,
        width: 300,
        height: 688,
      });

      render(<ExtensionSidebar />);

      expect(screen.getByTestId('extension-sidebar-dock-preview')).toHaveStyle({
        top: '80px',
        left: '320px',
        width: '300px',
        height: '688px',
        borderTopLeftRadius: '0',
      });
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
      mockUseFloatingDrag.mockReturnValue({ action: 'collapse', top: 588, left: 300, width: 400, height: 168 });

      render(<ExtensionSidebar />);

      expect(screen.getByTestId('extension-sidebar-collapse-preview')).toHaveStyle({
        top: '588px',
        left: '300px',
        width: '400px',
        height: '168px',
      });
    });
  });

  describe('while docked', () => {
    const floatingPluginId = 'grafana-assistant-app';
    const FloatingCapable = (props: { extensionSidebarPresentation?: string }) => <MockComponent {...props} />;
    FloatingCapable.meta = { ...MockComponent.meta, pluginId: floatingPluginId };

    const renderDocked = (
      component: typeof MockComponent | typeof FloatingCapable,
      context: Partial<ExtensionSidebarContextType> = {}
    ) => {
      const item: AddedComponentRegistryItem = {
        ...addedComponentRegistryItemMock,
        pluginId: component.meta.pluginId,
        component,
      };
      mockUsePluginComponents.mockReturnValue({
        components: [createComponentWithMeta(item, extensionPointId)],
        isLoading: false,
      });
      mockUseExtensionSidebarContext.mockReturnValue({
        ...extensionSidebarContextMock,
        dockedComponentId: getComponentIdFromComponentMeta(component.meta.pluginId, addedComponentConfigMock.title),
        ...context,
      });
      render(<ExtensionSidebar />);
    };

    afterEach(() => setTestFlags({}));

    it('lets a plugin that can float be dragged out to float', () => {
      setTestFlags({ 'grafana.extensionSidebarFloating': true, 'grafana.extensionSidebarPlacements': true });
      renderDocked(FloatingCapable);

      expect(mockUseDockedDrag.mock.lastCall?.[0]).toBeInstanceOf(HTMLElement);
      expect(mockUseDockedDrag.mock.lastCall?.[1]).toMatchObject({ floatingWidth: 480, dockSide: 'right' });
      mockUseDockedDrag.mock.lastCall?.[1].onFloat();
      expect(setExtensionSidebarPresentation).toHaveBeenCalledWith('floating');
    });

    it("lines up with the page's card when docked at the bottom, with the visual refresh", () => {
      mockUsePluginComponents.mockReturnValue({
        components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
        isLoading: false,
      });
      const theme = { ...createTheme(), flags: { visualDesignRefresh: true } };
      const renderOn = (dockSide: ExtensionSidebarContextType['dockSide']) => {
        mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, dockSide });
        const { container, unmount } = render(
          <ThemeContext.Provider value={theme}>
            <ExtensionSidebar />
          </ThemeContext.Provider>
        );
        const marginLeft = getComputedStyle(container.firstElementChild!).marginLeft;
        unmount();
        return marginLeft;
      };

      // The page's card is inset 4px from the page area's edges; docked on the right, the gap is at the window's edge.
      expect(renderOn('bottom')).toBe('4px');
      expect(renderOn('right')).toBe('');
    });

    it.each(['left', 'bottom'] as const)('drags out from the %s it is docked on', (dockSide) => {
      setTestFlags({ 'grafana.extensionSidebarFloating': true, 'grafana.extensionSidebarPlacements': true });
      renderDocked(FloatingCapable, { dockSide, extensionSidebarHeight: 280 });

      expect(mockUseDockedDrag.mock.lastCall?.[0]).toBeInstanceOf(HTMLElement);
      expect(mockUseDockedDrag.mock.lastCall?.[1]).toMatchObject({ dockSide, dockHeight: 280 });
    });

    it('docks on the other side, at its docked width, when the drag asks it to', () => {
      setTestFlags({ 'grafana.extensionSidebarFloating': true, 'grafana.extensionSidebarPlacements': true });
      renderDocked(FloatingCapable, { extensionSidebarWidth: 420 });

      expect(mockUseDockedDrag.mock.lastCall?.[1]).toMatchObject({ dockWidth: 420 });
      mockUseDockedDrag.mock.lastCall?.[1].onDock('left');

      expect(setExtensionSidebarDockSide).toHaveBeenCalledWith('left');
      expect(setExtensionSidebarPresentation).toHaveBeenCalledWith('docked');
    });

    it('offers no drag while the sidebar cannot float, or for a plugin that cannot', () => {
      renderDocked(FloatingCapable);
      expect(mockUseDockedDrag.mock.lastCall?.[0]).toBeNull();

      setTestFlags({ 'grafana.extensionSidebarFloating': true, 'grafana.extensionSidebarPlacements': true });
      renderDocked(MockComponent);
      expect(mockUseDockedDrag.mock.lastCall?.[0]).toBeNull();
    });

    it('shows the float preview where the drag puts it', () => {
      mockUseDockedDrag.mockReturnValue({ action: 'float', top: 216, left: 60, width: 480, height: 168 });
      setTestFlags({ 'grafana.extensionSidebarFloating': true, 'grafana.extensionSidebarPlacements': true });
      renderDocked(FloatingCapable);

      expect(screen.getByTestId('extension-sidebar-float-preview')).toHaveStyle({
        top: '216px',
        left: '60px',
        width: '480px',
        height: '168px',
      });
    });
  });
});
