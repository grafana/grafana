import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';

import { CustomHighlight } from '@grafana/data';

import { useLogListHighlightContext, LogListHighlightContext } from './LogListHighlightContext';

// Mock palette length to match typical theme palette size
const MOCK_PALETTE_LENGTH = 50;

describe('LogListHighlightContext', () => {
  const createWrapper = (highlights: CustomHighlight[], onChange: (highlights: CustomHighlight[]) => void) => {
    return ({ children }: { children: ReactNode }) => (
      <LogListHighlightContext.Provider
        value={{
          customHighlights: highlights,
          addHighlight: (text: string) => {
            const filtered = highlights.filter((h) => h.text !== text);
            const nextColorIndex = filtered.length % MOCK_PALETTE_LENGTH;
            onChange([...filtered, { text, colorIndex: nextColorIndex }]);
          },
          resetHighlights: () => onChange([]),
          hasHighlights: highlights.length > 0,
        }}
      >
        {children}
      </LogListHighlightContext.Provider>
    );
  };

  test('provides default context values', () => {
    const value = {
      customHighlights: [],
      addHighlight: jest.fn(),
      resetHighlights: jest.fn(),
      hasHighlights: false,
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LogListHighlightContext.Provider value={value}>{children}</LogListHighlightContext.Provider>
    );

    const { result } = renderHook(() => useLogListHighlightContext(), { wrapper });

    expect(result.current).toEqual(value);
  });

  test('addHighlight adds a new highlight', () => {
    let highlights: CustomHighlight[] = [];
    const onChange = (newHighlights: CustomHighlight[]) => {
      highlights = newHighlights;
    };
    const wrapper = createWrapper(highlights, onChange);

    const { result } = renderHook(() => useLogListHighlightContext(), { wrapper });

    act(() => {
      result.current.addHighlight('test text');
    });

    expect(highlights).toEqual([{ text: 'test text', colorIndex: 0 }]);
  });

  test('addHighlight re-highlights existing text with next color', () => {
    let highlights: CustomHighlight[] = [
      { text: 'first', colorIndex: 0 },
      { text: 'second', colorIndex: 1 },
    ];
    const onChange = (newHighlights: CustomHighlight[]) => {
      highlights = newHighlights;
    };

    const { result, rerender } = renderHook(() => useLogListHighlightContext(), {
      wrapper: ({ children }: { children: ReactNode }) => createWrapper(highlights, onChange)({ children }),
    });

    act(() => {
      result.current.addHighlight('first');
      rerender();
    });

    // First should be removed and re-added with color index 1 (since only 'second' remains before re-adding)
    expect(highlights).toEqual([
      { text: 'second', colorIndex: 1 },
      { text: 'first', colorIndex: 1 },
    ]);
  });

  test('resetHighlights clears all highlights', () => {
    let highlights: CustomHighlight[] = [
      { text: 'first', colorIndex: 0 },
      { text: 'second', colorIndex: 1 },
    ];
    const onChange = (newHighlights: CustomHighlight[]) => {
      highlights = newHighlights;
    };
    const wrapper = createWrapper(highlights, onChange);

    const { result } = renderHook(() => useLogListHighlightContext(), { wrapper });

    act(() => {
      result.current.resetHighlights();
    });

    expect(highlights).toEqual([]);
  });

  test('hasHighlights returns true when highlights exist', () => {
    const highlights: CustomHighlight[] = [{ text: 'test', colorIndex: 0 }];
    const onChange = jest.fn();
    const wrapper = createWrapper(highlights, onChange);

    const { result } = renderHook(() => useLogListHighlightContext(), { wrapper });

    expect(result.current.hasHighlights).toBe(true);
  });

  test('hasHighlights returns false when no highlights', () => {
    const highlights: CustomHighlight[] = [];
    const onChange = jest.fn();
    const wrapper = createWrapper(highlights, onChange);

    const { result } = renderHook(() => useLogListHighlightContext(), { wrapper });

    expect(result.current.hasHighlights).toBe(false);
  });

  test('color indexes cycle through available colors', () => {
    let highlights: CustomHighlight[] = [];
    const onChange = (newHighlights: CustomHighlight[]) => {
      highlights = newHighlights;
    };

    const { result, rerender } = renderHook(() => useLogListHighlightContext(), {
      wrapper: ({ children }: { children: ReactNode }) => createWrapper(highlights, onChange)({ children }),
    });

    // Add 51 highlights to test cycling (50 colors available)
    for (let i = 0; i < 51; i++) {
      act(() => {
        result.current.addHighlight(`text${i}`);
        rerender();
      });
    }

    expect(highlights).toHaveLength(51);
    // First highlight has color 0
    expect(highlights[0].colorIndex).toBe(0);
    // 50th highlight has color 49
    expect(highlights[49].colorIndex).toBe(49);
    // 51st highlight cycles back to color 0
    expect(highlights[50].colorIndex).toBe(0);
  });
});
