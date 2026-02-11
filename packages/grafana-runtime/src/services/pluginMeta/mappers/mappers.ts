import type { AppPluginMetasMapper, PanelPluginMetasMapper, PluginMetasResponse } from '../types';

import { v0alpha1AppMapper } from './v0alpha1AppMapper';
import { v0alpha1PanelMapper } from './v0alpha1PanelMapper';

export function getAppPluginMapper(): AppPluginMetasMapper<PluginMetasResponse> {
  return v0alpha1AppMapper;
}

export function getPanelPluginMapper(): PanelPluginMetasMapper<PluginMetasResponse> {
  return v0alpha1PanelMapper;
}
