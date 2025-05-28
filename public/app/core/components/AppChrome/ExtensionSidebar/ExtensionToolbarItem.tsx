import { Dropdown, Menu } from '@grafana/ui';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import {
  getComponentIdFromComponentMeta,
  getComponentMetaFromComponentId,
  useExtensionSidebarContext,
} from './ExtensionSidebarProvider';
import { ExtensionToolbarItemButton } from './ExtensionToolbarItemButton';

export function ExtensionToolbarItem() {
  const { availableComponents, dockedComponentId, setDockedComponentId, isOpen, isEnabled } =
    useExtensionSidebarContext();

  let dockedComponentTitle = '';
  if (dockedComponentId) {
    const dockedComponent = getComponentMetaFromComponentId(dockedComponentId);
    if (dockedComponent) {
      dockedComponentTitle = dockedComponent.componentTitle;
    }
  }

  if (!isEnabled || availableComponents.size === 0) {
    return null;
  }

  // get a flat list of all components with their pluginId
  const components = Array.from(availableComponents.entries()).flatMap(([pluginId, { addedComponents }]) =>
    addedComponents.map((c) => ({ ...c, pluginId }))
  );

  if (components.length === 0) {
    return null;
  }

  if (components.length === 1) {
    return (
      <>
        <ExtensionToolbarItemButton
          isOpen={isOpen}
          title={components[0].title}
          onClick={() => {
            if (isOpen) {
              setDockedComponentId(undefined);
            } else {
              setDockedComponentId(getComponentIdFromComponentMeta(components[0].pluginId, components[0]));
            }
          }}
        />
        <NavToolbarSeparator />
      </>
    );
  }

  const MenuItems = (
    <Menu>
      {components.map((c) => {
        const id = getComponentIdFromComponentMeta(c.pluginId, c);
        return (
          <Menu.Item
            key={id}
            active={dockedComponentId === id}
            label={c.title}
            onClick={() => {
              if (isOpen && dockedComponentId === id) {
                setDockedComponentId(undefined);
              } else {
                setDockedComponentId(id);
              }
            }}
          />
        );
      })}
    </Menu>
  );
  return (
    <>
      {isOpen ? (
        <ExtensionToolbarItemButton
          isOpen
          title={dockedComponentTitle}
          onClick={() => {
            if (isOpen) {
              setDockedComponentId(undefined);
            }
          }}
        />
      ) : (
        <Dropdown overlay={MenuItems} placement="bottom-end">
          <ExtensionToolbarItemButton isOpen={false} />
        </Dropdown>
      )}
      <NavToolbarSeparator />
    </>
  );
}
