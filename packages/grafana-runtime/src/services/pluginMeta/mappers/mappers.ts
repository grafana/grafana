import type {
  AppPluginMetasMapper,
  DatasourcePluginMetasMapper,
  PanelPluginMetasMapper,
  PluginMetasResponse,
} from '../types';

import { v0alpha1AppMapper } from './v0alpha1AppMapper';
import { v0alpha1DatasourceMapper } from './v0alpha1DatasourceMapper';
import { v0alpha1PanelMapper } from './v0alpha1PanelMapper';

export function getAppPluginMapper(): AppPluginMetasMapper<PluginMetasResponse> {
  return v0alpha1AppMapper;
}

export function getDatasourcePluginMapper(): DatasourcePluginMetasMapper<PluginMetasResponse> {
  return v0alpha1DatasourceMapper;
}

export function getPanelPluginMapper(): PanelPluginMetasMapper<PluginMetasResponse> {
  return v0alpha1PanelMapper;
}
