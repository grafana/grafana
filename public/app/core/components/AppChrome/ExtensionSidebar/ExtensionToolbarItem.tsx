import { ExtensionInfo } from '@grafana/data';
import { Dropdown, Menu } from '@grafana/ui';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import {
  getComponentIdFromComponentMeta,
  getComponentMetaFromComponentId,
  useExtensionSidebarContext,
} from './ExtensionSidebarProvider';
import { ExtensionToolbarItemButton } from './ExtensionToolbarItemButton';

type ComponentWithPluginId = ExtensionInfo & { pluginId: string };

type Props = {
  compact?: boolean;
};

const compactAllowedComponents = ['grafana-assistant-app'];

export function ExtensionToolbarItem({ compact }: Props) {
  const { availableComponents, dockedComponentId, setDockedComponentId, isEnabled } = useExtensionSidebarContext();

  if (!isEnabled || availableComponents.size === 0) {
    return null;
  }

  const dockedMeta = dockedComponentId ? getComponentMetaFromComponentId(dockedComponentId) : null;

  const renderPluginButton = (pluginId: string, components: ComponentWithPluginId[]) => {
    if (components.length === 1) {
      const component = components[0];
      const componentId = getComponentIdFromComponentMeta(pluginId, component);
      const isActive = dockedComponentId === componentId;

      // we now allow more components in the extension sidebar
      // in compact mode we only want to allow the Assistant app right now
      if (compact && !compactAllowedComponents.includes(pluginId)) {
        return null;
      }

      return (
        <ExtensionToolbarItemButton
          key={pluginId}
          isOpen={isActive}
          title={component.title}
          onClick={() => setDockedComponentId(isActive ? undefined : componentId)}
          pluginId={pluginId}
        />
      );
    }

    const isPluginActive = dockedMeta?.pluginId === pluginId;
    const MenuItems = (
      <Menu>
        {components.map((c) => {
          const id = getComponentIdFromComponentMeta(pluginId, c);
          return (
            <Menu.Item
              key={id}
              active={dockedComponentId === id}
              label={c.title}
              onClick={() => setDockedComponentId(dockedComponentId === id ? undefined : id)}
            />
          );
        })}
      </Menu>
    );

    return isPluginActive ? (
      <ExtensionToolbarItemButton
        key={pluginId}
        isOpen
        title={dockedMeta?.componentTitle}
        onClick={() => setDockedComponentId(undefined)}
        pluginId={pluginId}
      />
    ) : (
      <Dropdown key={pluginId} overlay={MenuItems} placement="bottom-end">
        <ExtensionToolbarItemButton isOpen={false} pluginId={pluginId} />
      </Dropdown>
    );
  };

  return (
    <>
      {/* renders a single `ExtensionToolbarItemButton` for each plugin; if a plugin has multiple components, it renders them inside a `Dropdown` */}
      {Array.from(availableComponents.entries()).map(
        ([pluginId, { addedComponents }]: [string, { addedComponents: ExtensionInfo[] }]) =>
          renderPluginButton(
            pluginId,
            addedComponents.map((c: ExtensionInfo) => ({ ...c, pluginId }))
          )
      )}
      <NavToolbarSeparator />
    </>
  );
}
