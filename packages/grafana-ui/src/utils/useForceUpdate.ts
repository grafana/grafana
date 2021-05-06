import { useState } from 'react';

/** @internal */
export function useForceUpdate() {
  const [value, setValue] = useState(0); // integer state
  return () => setValue(value + 1); // update the state to force render
}
