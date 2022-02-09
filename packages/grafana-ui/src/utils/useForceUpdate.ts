import { useState } from 'react';

/** @internal */
export function useForceUpdate() {
  const [_, setValue] = useState(0); // integer state
  return () => setValue((prevState) => prevState + 1); // update the state to force render
}
