import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { ChainDrawer } from './ChainDrawer';

interface ChainDrawerApi {
  openChainDrawer: (chainId: string, position: number) => void;
}

interface OpenChainState {
  chainId: string;
  position: number;
}

const ChainDrawerContext = createContext<ChainDrawerApi>({
  openChainDrawer: () => {},
});

interface ChainDrawerProviderProps {
  children: ReactNode;
}

export function ChainDrawerProvider({ children }: ChainDrawerProviderProps) {
  const [openChain, setOpenChain] = useState<OpenChainState | null>(null);

  const openChainDrawer = useCallback((chainId: string, position: number) => {
    setOpenChain({ chainId, position });
  }, []);

  const api = useMemo<ChainDrawerApi>(() => ({ openChainDrawer }), [openChainDrawer]);

  return (
    <ChainDrawerContext.Provider value={api}>
      {children}
      {openChain && (
        <ChainDrawer
          chainId={openChain.chainId}
          currentPosition={openChain.position}
          onClose={() => setOpenChain(null)}
        />
      )}
    </ChainDrawerContext.Provider>
  );
}

export function useChainDrawer(): ChainDrawerApi {
  return useContext(ChainDrawerContext);
}
