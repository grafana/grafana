import { render, screen } from 'test/test-utils';

import { Components } from '@grafana/e2e-selectors';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from '../ExtensionSidebar/ExtensionSidebarProvider';

import { SingleTopBarActions } from './SingleTopBarActions';

jest.mock('app/core/hooks/useMediaQueryMinWidth');

jest.mock('../ExtensionSidebar/ExtensionSidebarProvider', () => ({
  ...jest.requireActual('../ExtensionSidebar/ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

const openSidebarContext: ExtensionSidebarContextType = {
  isOpen: true,
  dockedComponentId: 'p/c/v',
  setDockedComponentId: jest.fn(),
  availableComponents: new Map(),
  extensionSidebarWidth: 300,
  setExtensionSidebarWidth: jest.fn(),
  extensionSidebarHeight: 320,
  setExtensionSidebarHeight: jest.fn(),
  floatingExtensionSidebarWidth: 480,
  setFloatingExtensionSidebarWidth: jest.fn(),
  floatingHeightOptions: null,
  floatingExtensionSidebarHeight: undefined,
  setFloatingExtensionSidebarHeight: jest.fn(),
  presentation: 'docked',
  dockSide: 'right',
  floatingHidden: false,
};

/** The declarations of the class rules on `element`. */
const stylesFor = (element: Element) => {
  const selectors = new Set(Array.from(element.classList, (className) => `.${className}`));
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && selectors.has(rule.selectorText))
    .map((rule) => rule.style.cssText)
    .join('\n');
};

describe('SingleTopBarActions', () => {
  beforeEach(() => {
    jest.mocked(useMediaQueryMinWidth).mockReturnValue(true);
  });

  it('leaves room for the sidebar docked on the right', () => {
    jest.mocked(useExtensionSidebarContext).mockReturnValue(openSidebarContext);
    render(<SingleTopBarActions actions={<button type="button">Action</button>} />);

    expect(stylesFor(screen.getByTestId(Components.NavToolbar.container))).toContain('max-width: calc(100% - 300px)');
  });

  it.each(['left', 'bottom'] as const)('keeps its full width while the sidebar is docked on the %s', (dockSide) => {
    jest.mocked(useExtensionSidebarContext).mockReturnValue({ ...openSidebarContext, dockSide });
    render(<SingleTopBarActions actions={<button type="button">Action</button>} />);

    expect(stylesFor(screen.getByTestId(Components.NavToolbar.container))).not.toContain('max-width');
  });
});
