import { useContext } from 'react';

import { PluginMeta } from '../../types';

import { Context, PluginContextType } from './PluginContext';

export function usePluginContext(): PluginContextType {
  const context = useContext(Context);
  if (!context) {
    throw new Error('usePluginContext must be used within a PluginContextProvider');
  }
  return context;
}

export function usePluginMeta(): PluginMeta {
  const context = usePluginContext();

  return context.meta;
}

export function usePluginJsonData() {
  const context = usePluginContext();

  return context.meta.jsonData;
}

export function usePluginVersion() {
  const context = usePluginContext();

  return context.meta.info.version;
}
