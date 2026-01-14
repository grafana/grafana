import { AppPluginMetasMapper, PluginMetasResponse } from '../types';

import { v0alpha1AppMapper } from './v0alpha1AppMapper';

export function getAppPluginMapper(): AppPluginMetasMapper<PluginMetasResponse> {
  return v0alpha1AppMapper;
}
