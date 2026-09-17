import { renderHook, waitFor } from '@testing-library/react';

import { useFunctionSignatures } from './useFunctionSignatures';

describe('useFunctionSignatures', () => {
  it('does not load signatures when disabled', () => {
    const { result } = renderHook(() => useFunctionSignatures(false));

    expect(result.current).toBeUndefined();
  });

  it('lazily loads the signature metadata when enabled', async () => {
    const { result } = renderHook(() => useFunctionSignatures(true));

    expect(result.current).toBeUndefined();

    await waitFor(() => expect(result.current?.length).toBeGreaterThan(0));
  });
});
