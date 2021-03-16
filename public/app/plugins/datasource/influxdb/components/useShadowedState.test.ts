import { renderHook, act } from '@testing-library/react-hooks';
import { useShadowedState } from './useShadowedState';

describe('useShadowedState', () => {
  it('should work correctly', () => {
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
});
