import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EventBusSrv, store } from '@grafana/data';
import { config, setAppEvents, usePluginLinks } from '@grafana/runtime';
import { getExtensionPointPluginMeta } from 'app/features/plugins/extensions/utils';

import { ExtensionSidebarContextProvider, useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { ExtensionToolbarItem } from './ExtensionToolbarItem';

// Mock the extension point plugin meta
jest.mock('app/features/plugins/extensions/utils', () => ({
  ...jest.requireActual('app/features/plugins/extensions/utils'),
  getExtensionPointPluginMeta: jest.fn(),
}));

// Mock store
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
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      ...jest.requireActual('@grafana/runtime').config.featureToggles,
      extensionSidebar: true,
    },
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

const mockComponent = {
  title: 'Test Component',
  description: 'Test Description',
  targets: [],
};

const mockPluginMeta = {
  pluginId: 'grafana-investigations-app',
  addedComponents: [mockComponent],
};

const TestComponent = () => {
  const { isOpen, dockedComponentId } = useExtensionSidebarContext();
  return (
    <div>
      <div data-testid="is-open">{isOpen.toString()}</div>
      <div data-testid="docked-component-id">{dockedComponentId}</div>
    </div>
  );
};

const setup = () => {
  return render(
    <ExtensionSidebarContextProvider>
      <ExtensionToolbarItem />
      <TestComponent />
    </ExtensionSidebarContextProvider>
  );
};

describe('ExtensionToolbarItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(new Map([[mockPluginMeta.pluginId, mockPluginMeta]]));
    (store.get as jest.Mock).mockClear();
    (store.set as jest.Mock).mockClear();
    (store.delete as jest.Mock).mockClear();
    jest.replaceProperty(config.featureToggles, 'extensionSidebar', true);
    setAppEvents(new EventBusSrv());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when feature toggle is disabled', () => {
    jest.replaceProperty(config.featureToggles, 'extensionSidebar', false);
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should not render when no components are available', () => {
    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(new Map());
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render a single button when only one component is available', () => {
    setup();

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', `Open ${mockComponent.title}`);
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent('');
  });

  it('should toggle the sidebar when clicking a single component button', async () => {
    setup();

    const button = screen.getByTestId('extension-toolbar-button-open');
    await userEvent.click(button);

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent(mockComponent.title);
  });

  it('should render a dropdown menu when multiple components are available', async () => {
    const multipleComponentsMeta = {
      pluginId: 'grafana-investigations-app',
      addedComponents: [
        { ...mockComponent, title: 'Component 1' },
        { ...mockComponent, title: 'Component 2' },
      ],
    };

    (usePluginLinks as jest.Mock).mockReturnValue({
      links: [
        { pluginId: multipleComponentsMeta.pluginId, title: multipleComponentsMeta.addedComponents[0].title },
        { pluginId: multipleComponentsMeta.pluginId, title: multipleComponentsMeta.addedComponents[1].title },
      ],
      isLoading: false,
    });

    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(
      new Map([[multipleComponentsMeta.pluginId, multipleComponentsMeta]])
    );

    setup();

    const button = screen.getByTestId('extension-toolbar-button-open');
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(screen.getAllByRole('menuitem')).toHaveLength(multipleComponentsMeta.addedComponents.length);
    expect(screen.getByText(multipleComponentsMeta.addedComponents[0].title)).toBeInTheDocument();
    expect(screen.getByText(multipleComponentsMeta.addedComponents[1].title)).toBeInTheDocument();
  });

  it('should show menu items when clicking the dropdown button', async () => {
    const multipleComponentsMeta = {
      pluginId: 'grafana-investigations-app',
      addedComponents: [
        { ...mockComponent, title: 'Component 1' },
        { ...mockComponent, title: 'Component 2' },
      ],
    };

    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(
      new Map([[multipleComponentsMeta.pluginId, multipleComponentsMeta]])
    );

    setup();

    const button = screen.getByTestId('extension-toolbar-button-open');
    await userEvent.click(button);

    // Menu items should be visible
    expect(screen.getByText('Component 1')).toBeInTheDocument();
    expect(screen.getByText('Component 2')).toBeInTheDocument();
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should toggle the sidebar when clicking a menu item', async () => {
    const multipleComponentsMeta = {
      pluginId: 'grafana-investigations-app',
      addedComponents: [
        { ...mockComponent, title: 'Component 1' },
        { ...mockComponent, title: 'Component 2' },
      ],
    };

    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(
      new Map([[multipleComponentsMeta.pluginId, multipleComponentsMeta]])
    );

    setup();

    // Open the dropdown
    const button = screen.getByTestId('extension-toolbar-button-open');
    await userEvent.click(button);

    // Click a menu item
    await userEvent.click(screen.getByText('Component 1'));

    // The button should now be active
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('docked-component-id')).toHaveTextContent('Component 1');
  });

  it('should close the sidebar when clicking an active menu item', async () => {
    const multipleComponentsMeta = {
      pluginId: 'grafana-investigations-app',
      addedComponents: [
        { ...mockComponent, title: 'Component 1' },
        { ...mockComponent, title: 'Component 2' },
      ],
    };

    (getExtensionPointPluginMeta as jest.Mock).mockReturnValue(
      new Map([[multipleComponentsMeta.pluginId, multipleComponentsMeta]])
    );

    setup();

    const openButton = screen.getByTestId('extension-toolbar-button-open');
    await userEvent.click(openButton);
    const component1 = screen.getByText('Component 1');
    await userEvent.click(component1);

    const closeButton = screen.getByTestId('extension-toolbar-button-close');
    await userEvent.click(closeButton);

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });
});
