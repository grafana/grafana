import { useMemo } from 'react';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { usePluginComponents } from 'app/features/plugins/extensions/usePluginComponents';

import { type UserListTabExtensionProps } from './UserListPage.types';

export function useUserListTabExtensions(): Array<ComponentTypeWithExtensionMeta<UserListTabExtensionProps>> {
  const { components } = usePluginComponents<UserListTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.UserListTab,
  });

  return useMemo(
    () => components.filter((component) => component.meta.pluginId === SETUPGUIDE_PLUGIN_ID),
    [components]
  );
}
