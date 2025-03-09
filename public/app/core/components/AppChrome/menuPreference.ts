import { store } from '@grafana/data';
import { config } from '@grafana/runtime';

export const DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.docked';

export enum MenuDockState {
  Undocked,
  Docked,
  AutoDocked,
}

export function getMegaMenuDockedState() {
  if (window.innerWidth < config.theme2.breakpoints.values.xl) {
    return MenuDockState.Undocked;
  }

  const preference = store.getBool(DOCKED_LOCAL_STORAGE_KEY, null);

  if (preference === null && window.innerWidth >= config.theme2.breakpoints.values.xxl) {
    return MenuDockState.AutoDocked;
  }

  return preference ? MenuDockState.Docked : MenuDockState.Undocked;
}
