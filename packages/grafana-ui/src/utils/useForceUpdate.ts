import { useCallback, useState } from 'react';

/** @internal */
export function useForceUpdate() {
  const [_, setValue] = useState(0); // integer state
  return useCallback(() => setValue((prevState) => prevState + 1), []);
}
