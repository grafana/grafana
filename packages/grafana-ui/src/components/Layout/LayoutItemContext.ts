import { createContext } from 'react';

export interface LayoutItemContextProps {
  setAnchoredCount: (nextCount: ((prevCount: number) => number) | number) => void;
}

export const LayoutItemContext = createContext<LayoutItemContextProps>({
  setAnchoredCount: () => {},
});
