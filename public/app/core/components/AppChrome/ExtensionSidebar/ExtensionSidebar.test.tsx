import { fireEvent, render, screen } from '@testing-library/react';

import { type ExtensionInfo, PluginExtensionTypes } from '@grafana/data';
import { config, usePluginComponents } from '@grafana/runtime';
import { type AddedComponentRegistryItem } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { EXTENSION_FLOATING_INSET_VAR, ExtensionSidebar, MAX_EXTENSION_FLOATING_INSET } from './ExtensionSidebar';
import { type ExtensionSidebarContextType, useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { getComponentIdFromComponentMeta } from './extensionSidebarUtils';
import { FLOATING_DRAG_HANDLE_ATTRIBUTE } from './useFloatingDrag';

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
  presentation: 'docked',
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

  it('writes the floating inset, capped, only when it changes', () => {
    // Every observer on the page (the inset and the drag clamp) is notified, as a browser would.
    const callbacks: Array<() => void> = [];
    const notify = () => callbacks.forEach((callback) => callback());
    const original = window.ResizeObserver;
    class ManualResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(() => callback([], this));
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ManualResizeObserver;
    const setProperty = jest.spyOn(document.documentElement.style, 'setProperty');
    let height = 60;
    const rect = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the height is read
      .mockImplementation(() => ({ height }) as DOMRect);
    try {
      mockUsePluginComponents.mockReturnValue({
        components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
        isLoading: false,
      });
      mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'floating' });
      render(<ExtensionSidebar />);
      const writes = () => setProperty.mock.calls.filter(([name]) => name === EXTENSION_FLOATING_INSET_VAR);
      expect(writes()).toHaveLength(1);

      // Small content: its height plus the 24px gap.
      expect(document.documentElement.style.getPropertyValue(EXTENSION_FLOATING_INSET_VAR)).toBe('84px');

      notify();
      notify();
      expect(writes()).toHaveLength(1);

      height = 80;
      notify();
      expect(writes()).toHaveLength(2);
      expect(document.documentElement.style.getPropertyValue(EXTENSION_FLOATING_INSET_VAR)).toBe('104px');

      // An expanded panel is capped, and further growth past the cap writes nothing.
      height = 720;
      notify();
      expect(document.documentElement.style.getPropertyValue(EXTENSION_FLOATING_INSET_VAR)).toBe(
        `${MAX_EXTENSION_FLOATING_INSET}px`
      );
      height = 900;
      notify();
      expect(writes()).toHaveLength(3);
    } finally {
      window.ResizeObserver = original;
      setProperty.mockRestore();
      rect.mockRestore();
    }
  });

  it('drops the floating inset while the sidebar is moved away from the bottom corner', () => {
    const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const match = /translate\((-?\d+)px, (-?\d+)px\)/.exec(this.style.transform);
      const [x, y] = match ? [Number(match[1]), Number(match[2])] : [0, 0];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured box without toJSON
      return { left: 600 + x, top: 500 + y, width: 400, height: 244, right: 1000 + x, bottom: 744 + y } as DOMRect;
    });
    const HandleComponent = () => (
      <button type="button" {...{ [FLOATING_DRAG_HANDLE_ATTRIBUTE]: '' }}>
        Move
      </button>
    );
    try {
      mockUsePluginComponents.mockReturnValue({
        components: [
          createComponentWithMeta({ ...addedComponentRegistryItemMock, component: HandleComponent }, extensionPointId),
        ],
        isLoading: false,
      });
      mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'floating' });
      render(<ExtensionSidebar />);
      expect(document.documentElement.style.getPropertyValue(EXTENSION_FLOATING_INSET_VAR)).not.toBe('0px');

      fireEvent.keyDown(screen.getByRole('button', { name: 'Move' }), { key: 'ArrowUp', shiftKey: true });

      expect(document.documentElement.style.getPropertyValue(EXTENSION_FLOATING_INSET_VAR)).toBe('0px');
    } finally {
      rect.mockRestore();
    }
  });

  it('tells the extension its presentation and publishes the floating inset only while floating', () => {
    mockUsePluginComponents.mockReturnValue({
      components: [createComponentWithMeta(addedComponentRegistryItemMock, extensionPointId)],
      isLoading: false,
    });
    mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'floating' });

    const { rerender } = render(<ExtensionSidebar />);
    const component = screen.getByTestId('working-component');
    expect(component).toHaveAttribute('data-presentation', 'floating');
    expect(document.documentElement.style.getPropertyValue(EXTENSION_FLOATING_INSET_VAR)).toMatch(/px$/);

    mockUseExtensionSidebarContext.mockReturnValue({ ...extensionSidebarContextMock, presentation: 'docked' });
    rerender(<ExtensionSidebar />);
    expect(screen.getByTestId('working-component')).toBe(component);
    expect(component).toHaveAttribute('data-presentation', 'docked');
    expect(document.documentElement.style.getPropertyValue(EXTENSION_FLOATING_INSET_VAR)).toBe('');
  });
});
