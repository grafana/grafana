import { render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import * as provider from '../ExtensionSidebar/ExtensionSidebarProvider';
import { CORE_NOTEBOOKS_COMPONENT_ID } from '../ExtensionSidebar/coreSidebarComponents';

import { NotebooksTopBarButton } from './NotebooksTopBarButton';

function mockSidebar(dockedComponentId?: string) {
  const setDockedComponentId = jest.fn();
  jest.spyOn(provider, 'useExtensionSidebarContext').mockReturnValue({
    isOpen: dockedComponentId !== undefined,
    dockedComponentId,
    setDockedComponentId,
    availableComponents: new Map(),
    extensionSidebarWidth: 500,
    setExtensionSidebarWidth: jest.fn(),
    floatingExtensionSidebarWidth: 500,
    setFloatingExtensionSidebarWidth: jest.fn(),
    presentation: 'docked',
    floatingHidden: false,
  });
  return setDockedComponentId;
}

describe('NotebooksTopBarButton', () => {
  beforeEach(() => {
    setTestFlags({ 'dashboard.notebooks': true });
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when the flag is off', () => {
    setTestFlags({ 'dashboard.notebooks': false });
    mockSidebar();
    render(<NotebooksTopBarButton />);

    expect(screen.queryByRole('button', { name: 'Notebooks' })).not.toBeInTheDocument();
  });

  it('renders nothing without read permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    mockSidebar();
    render(<NotebooksTopBarButton />);

    expect(screen.queryByRole('button', { name: 'Notebooks' })).not.toBeInTheDocument();
  });

  it('closes the panel when it is already open', async () => {
    const setDocked = mockSidebar(CORE_NOTEBOOKS_COMPONENT_ID);
    const { user } = render(<NotebooksTopBarButton />);

    const button = screen.getByRole('button', { name: 'Notebooks' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(button);

    expect(setDocked).toHaveBeenCalledWith(undefined);
  });
});
