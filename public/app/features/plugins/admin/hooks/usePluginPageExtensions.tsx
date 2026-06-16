import * as React from 'react';

import { type PageInfoItem } from '../../../../core/components/Page/types';
import { PluginActions } from '../components/PluginActions';
import { PluginSubtitle } from '../components/PluginSubtitle';
import { type CatalogPlugin } from '../types';

import { usePluginInfo } from './usePluginInfo';

type ReturnType = {
  actions: React.ReactNode;
  info: PageInfoItem[];
  subtitle: React.ReactNode;
};

export const usePluginPageExtensions = (plugin?: CatalogPlugin): ReturnType => {
  const info = usePluginInfo(plugin);

  return {
    actions: <PluginActions plugin={plugin} />,
    info,
    subtitle: <PluginSubtitle plugin={plugin} />,
  };
};
