import { act, getWrapper, renderHook } from 'test/test-utils';

import { PageLayoutType } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { type AppChromeState } from '../AppChromeService';

import { registerSectionSidebar } from './registry';
import { type SectionSidebarDefinition } from './types';
import { getSectionSidebarOffsets, SECTION_SIDEBAR_WIDTH, useActiveSectionSidebar } from './utils';

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: jest.fn(() => true),
}));

const FLAG = 'grafana.sectionSidebar';

const dashboards: SectionSidebarDefinition = {
  id: 'dashboards',
  title: 'Dashboards',
  navIds: ['dashboards/browse'],
  groups: [],
};
const alerting: SectionSidebarDefinition = { id: 'alerting', title: 'Alerting', navIds: ['alerting'], groups: [] };

function createState(overrides: Partial<AppChromeState> = {}): AppChromeState {
  return {
    chromeless: false,
    sectionNav: { node: { text: 'Dashboards' }, main: { id: 'dashboards/browse', text: 'Dashboards' } },
    megaMenuOpen: false,
    megaMenuDocked: false,
    kioskMode: null,
    layout: PageLayoutType.Standard,
    ...overrides,
  };
}

describe('useActiveSectionSidebar', () => {
  const cleanups: Array<() => void> = [];

  beforeEach(async () => {
    cleanups.push(registerSectionSidebar(dashboards), registerSectionSidebar(alerting));
    await act(async () => setTestFlags({ [FLAG]: true }));
  });

  afterEach(async () => {
    act(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
    jest.mocked(useMediaQueryMinWidth).mockReturnValue(true);
    await act(async () => setTestFlags({}));
  });

  it('matches the section by nav id and passes the page context', () => {
    const state = createState({ sectionSidebarOverride: { context: { folderUid: 'f1' } } });
    const { result } = renderHook(() => useActiveSectionSidebar(state), { wrapper: getWrapper({}) });

    expect(result.current?.definition).toBe(dashboards);
    expect(result.current?.context).toEqual({ sectionId: 'dashboards', pageContext: { folderUid: 'f1' } });
  });

  it('prefers a section forced by the page over nav matching', () => {
    const state = createState({ sectionSidebarOverride: { sectionId: 'alerting' } });
    const { result } = renderHook(() => useActiveSectionSidebar(state), { wrapper: getWrapper({}) });

    expect(result.current?.definition).toBe(alerting);
  });

  it.each([
    ['the page opts out', createState({ sectionSidebarOverride: { disabled: true } })],
    ['the chrome is hidden', createState({ chromeless: true })],
    [
      'no section matches the nav',
      createState({ sectionNav: { node: { text: 'Explore' }, main: { id: 'explore', text: 'Explore' } } }),
    ],
  ])('returns nothing when %s', (_, state) => {
    const { result } = renderHook(() => useActiveSectionSidebar(state), { wrapper: getWrapper({}) });
    expect(result.current).toBeUndefined();
  });

  it('returns nothing on small screens', () => {
    jest.mocked(useMediaQueryMinWidth).mockReturnValue(false);
    const { result } = renderHook(() => useActiveSectionSidebar(createState()), { wrapper: getWrapper({}) });
    expect(result.current).toBeUndefined();
  });

  it('returns nothing when the feature flag is off', async () => {
    await act(async () => setTestFlags({}));
    const { result } = renderHook(() => useActiveSectionSidebar(createState()), { wrapper: getWrapper({}) });
    expect(result.current).toBeUndefined();
  });
});

describe('getSectionSidebarOffsets', () => {
  it.each([
    { menuDocked: false, scopesOpen: false, left: 0 },
    { menuDocked: true, scopesOpen: false, left: 320 },
    { menuDocked: true, scopesOpen: true, left: 640 },
    { menuDocked: false, scopesOpen: true, left: 320 },
  ])('docked=$menuDocked scopes=$scopesOpen puts the sidebar at $left', ({ left, ...input }) => {
    expect(getSectionSidebarOffsets({ menuWidth: 320, scopesWidth: 320, ...input })).toEqual({
      left,
      width: SECTION_SIDEBAR_WIDTH,
      contentPaddingLeft: left + SECTION_SIDEBAR_WIDTH,
    });
  });
});
