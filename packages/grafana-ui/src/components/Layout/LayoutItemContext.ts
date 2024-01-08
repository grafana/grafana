import { createContext } from 'react';

export interface LayoutItemContextProps {
  incrPinnedCount: (count: number) => void;
}

export const LayoutItemContext = createContext<LayoutItemContextProps>({
  incrPinnedCount: () => {},
});
