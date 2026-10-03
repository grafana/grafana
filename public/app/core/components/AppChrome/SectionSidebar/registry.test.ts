import { act, renderHook } from '@testing-library/react';

import {
  getSectionSidebarById,
  getSectionSidebarForNavId,
  registerSectionSidebar,
  useSectionSidebarDefinitions,
} from './registry';
import { type SectionSidebarDefinition } from './types';

function createDefinition(overrides: Partial<SectionSidebarDefinition> = {}): SectionSidebarDefinition {
  return { id: 'test', title: 'Test', navIds: ['test/nav'], groups: [], ...overrides };
}

describe('section sidebar registry', () => {
  const cleanups: Array<() => void> = [];
  const register = (definition: SectionSidebarDefinition) => {
    cleanups.push(registerSectionSidebar(definition));
  };

  afterEach(() => {
    act(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
  });

  it('finds a definition by id and by nav id', () => {
    const definition = createDefinition({ navIds: ['a', 'b'] });
    register(definition);

    expect(getSectionSidebarById('test')).toBe(definition);
    expect(getSectionSidebarForNavId('b')).toBe(definition);
    expect(getSectionSidebarForNavId('c')).toBeUndefined();
    expect(getSectionSidebarForNavId(undefined)).toBeUndefined();
  });

  it('keeps the first definition when an id is registered twice', () => {
    const first = createDefinition();
    register(first);
    register(createDefinition({ title: 'Second' }));

    expect(getSectionSidebarById('test')).toBe(first);
  });

  it('removes a definition when unregistered', () => {
    const unregister = registerSectionSidebar(createDefinition());
    unregister();

    expect(getSectionSidebarById('test')).toBeUndefined();
    expect(getSectionSidebarForNavId('test/nav')).toBeUndefined();
  });

  it('re-renders subscribers when a definition is registered later', () => {
    const { result } = renderHook(() => useSectionSidebarDefinitions());
    expect(result.current).toEqual([]);

    const definition = createDefinition();
    act(() => register(definition));

    expect(result.current).toEqual([definition]);
  });
});
