import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { ContentOutlineContextProvider, useContentOutlineContext } from './ContentOutlineContext';

const setup = () => {
  const { result } = renderHook(() => useContentOutlineContext(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ContentOutlineContextProvider>{children}</ContentOutlineContextProvider>
    ),
  });

  return result;
};

// Items are sorted by document position, so refs have to be attached elements.
const appendRef = () => document.body.appendChild(document.createElement('div'));

afterEach(() => {
  document.body.replaceChildren();
});

describe('ContentOutlineContextProvider', () => {
  describe('children registering before their root parent', () => {
    it('holds them back until the parent registers, then attaches them', () => {
      const result = setup();
      const firstRef = appendRef();
      const secondRef = appendRef();
      const rootRef = appendRef();

      act(() => {
        result.current!.register({ panelId: 'Queries', title: 'A', icon: 'arrow', ref: firstRef, level: 'child' });
        result.current!.register({ panelId: 'Queries', title: 'B', icon: 'arrow', ref: secondRef, level: 'child' });
      });

      expect(result.current!.outlineItems).toEqual([]);

      act(() => {
        result.current!.register({ panelId: 'Queries', title: 'Queries', icon: 'arrow', ref: rootRef, level: 'root' });
      });

      expect(result.current!.outlineItems).toHaveLength(1);
      expect(result.current!.outlineItems[0].children?.map((child) => child.title)).toEqual(['A', 'B']);
    });

    it('repoints filter children at the parent ref so clicking one scrolls to the parent', () => {
      const result = setup();
      const filterRef = appendRef();
      const queryRef = appendRef();
      const rootRef = appendRef();

      act(() => {
        result.current!.register({
          panelId: 'Logs',
          title: 'level=error',
          icon: 'filter',
          ref: filterRef,
          level: 'child',
          type: 'filter',
        });
        result.current!.register({ panelId: 'Logs', title: 'A', icon: 'arrow', ref: queryRef, level: 'child' });
      });

      act(() => {
        result.current!.register({ panelId: 'Logs', title: 'Logs', icon: 'gf-logs', ref: rootRef, level: 'root' });
      });

      const children = result.current!.outlineItems[0].children ?? [];
      expect(children.find((child) => child.title === 'level=error')?.ref).toBe(rootRef);
      expect(children.find((child) => child.title === 'A')?.ref).toBe(queryRef);
    });

    it('drops a repeat filter with the same title', () => {
      const result = setup();
      const rootRef = appendRef();

      act(() => {
        result.current!.register({
          panelId: 'Logs',
          title: 'level=error',
          icon: 'filter',
          ref: appendRef(),
          level: 'child',
          type: 'filter',
        });
        result.current!.register({
          panelId: 'Logs',
          title: 'level=error',
          icon: 'filter',
          ref: appendRef(),
          level: 'child',
          type: 'filter',
        });
      });

      act(() => {
        result.current!.register({ panelId: 'Logs', title: 'Logs', icon: 'gf-logs', ref: rootRef, level: 'root' });
      });

      expect(result.current!.outlineItems[0].children).toHaveLength(1);
    });
  });

  it('updates an already registered filter rather than adding a duplicate', () => {
    const result = setup();
    const rootRef = appendRef();
    const filter = {
      panelId: 'Logs',
      title: 'level=error',
      icon: 'filter',
      ref: appendRef(),
      level: 'child',
      type: 'filter',
    } as const;

    act(() => {
      result.current!.register({ panelId: 'Logs', title: 'Logs', icon: 'gf-logs', ref: rootRef, level: 'root' });
    });
    act(() => {
      result.current!.register({ ...filter, highlight: false });
    });
    act(() => {
      result.current!.register({ ...filter, highlight: true });
    });

    expect(result.current!.outlineItems[0].children).toHaveLength(1);
    expect(result.current!.outlineItems[0].children?.[0].highlight).toBe(true);
  });

  it('merges properties into the item matching the id passed to updateItem', () => {
    const result = setup();
    let id = '';

    act(() => {
      id = result.current!.register({
        panelId: 'Logs',
        title: 'Logs',
        icon: 'gf-logs',
        ref: appendRef(),
        level: 'root',
      });
      result.current!.register({
        panelId: 'Queries',
        title: 'Queries',
        icon: 'arrow',
        ref: appendRef(),
        level: 'root',
      });
    });

    act(() => {
      result.current!.updateItem(id, { expanded: true });
    });

    expect(result.current!.outlineItems.find((item) => item.id === id)?.expanded).toBe(true);
    expect(result.current!.outlineItems.find((item) => item.id !== id)?.expanded).toBeUndefined();
  });
});
