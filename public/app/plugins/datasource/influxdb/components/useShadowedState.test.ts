import { renderHook, act } from '@testing-library/react';

import { useShadowedState } from './useShadowedState';

describe('useShadowedState', () => {
  it('should handle outside changes', () => {
    const { result, rerender } = renderHook(({ outsideVal }) => useShadowedState(outsideVal), {
      initialProps: { outsideVal: '42' },
    });

    // first we verify it has the initial value
    expect(result.current[0]).toBe('42');

    // then we change it
    act(() => {
      result.current[1]('53');
    });

    // and verify it has the changed value
    expect(result.current[0]).toBe('53');

    // then we change the value from the outside
    rerender({ outsideVal: '71' });

    // and verify the now has the value from the outside
    expect(result.current[0]).toBe('71');
  });
  it('should handle changs applied from inside to outside', () => {
    // this is a test-case created because of a bug that was
    // found with this component, it happens when:
    // 1. the value is changed inside
    // 2. the inside-value gets applied to the outside-component,
    //    so now the outside-value again matches the inside-value
    // 3. the value changes again inside
    // at this point the value should be correct.
    const { result, rerender } = renderHook(({ outsideVal }) => useShadowedState(outsideVal), {
      initialProps: { outsideVal: '1' },
    });

    // first we verify it has the initial value
    expect(result.current[0]).toBe('1');

    // then we change it
    act(() => {
      result.current[1]('2');
    });

    // and verify it has the changed value
    expect(result.current[0]).toBe('2');

    // then we change the value from the outside to the same
    // value as the one inside (2)
    // (this simulates the case when the inside value gets
    // propageted to the outside component)
    rerender({ outsideVal: '2' });

    // and verify the the value is ok
    expect(result.current[0]).toBe('2');

    // and now change the inside-value again
    act(() => {
      result.current[1]('3');
    });

    // and verify the the value is ok
    expect(result.current[0]).toBe('3');
  });
});
