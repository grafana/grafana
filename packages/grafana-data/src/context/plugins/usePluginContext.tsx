import { useContext } from 'react';

import { Context, PluginContextType } from './PluginContext';

export function usePluginContext(): PluginContextType {
  const context = useContext(Context);
  if (!context) {
    throw new Error('add a b etter error message');
  }
  return context;
}
