import { useState } from 'react';

/** @internal */
export function useForceUpdate() {
  // @ts-ignore ignoring the return value and using the callback setter instead
  const [_, setValue] = useState(0); // integer state
  return () => setValue((v) => v + 1); // update the state to force render
}
