import { createContext, useContext } from 'react';

import { type ViewParams } from './model/types';
import { type TilingLayoutContextValue, type TilingViewApi } from './types';

export const TilingLayoutContext = createContext<TilingLayoutContextValue | null>(null);
export const TilingViewContext = createContext<TilingViewApi | null>(null);

/** The layout's state and imperative API. Works anywhere inside `<TilingLayout>`, including view content. */
export function useTilingLayout(): TilingLayoutContextValue {
  const ctx = useContext(TilingLayoutContext);
  if (!ctx) {
    throw new Error('useTilingLayout must be used inside <TilingLayout>');
  }
  return ctx;
}

/** The view whose content is rendering. Throws outside view content. */
export function useTilingView<P extends object = ViewParams>(): TilingViewApi<P> {
  const ctx = useContext(TilingViewContext);
  if (!ctx) {
    throw new Error('useTilingView must be used inside a tiling layout view');
  }
  // The params type is chosen by the consumer that created the view.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ctx as unknown as TilingViewApi<P>;
}

export function useOptionalTilingView(): TilingViewApi | null {
  return useContext(TilingViewContext);
}
