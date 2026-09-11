import { type SettingsMapper } from '../types';

import { v0alpha1SettingsMapper } from './v0alpha1SettingsMapper';

export function getSettingsMapper(): SettingsMapper {
  return v0alpha1SettingsMapper;
}
