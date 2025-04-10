import { useState } from 'react';

import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { getComponentIdFromComponentMeta, useExtensionSidebarContext } from './ExtensionSidebarProvider';

export function ExtensionToolbarItem() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { availableComponents, dockedComponentId, setDockedComponentId, isOpen, isEnabled } =
    useExtensionSidebarContext();

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
        <ToolbarButton
          icon="web-section"
          data-testid="extension-toolbar-button"
          variant={isOpen ? 'active' : 'default'}
          tooltip={components[0].description}
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
      <Dropdown overlay={MenuItems} onVisibleChange={setIsMenuOpen} placement="bottom-end">
        <ToolbarButton
          data-testid="extension-toolbar-button"
          icon="web-section"
          isOpen={isMenuOpen}
          variant={isOpen ? 'active' : 'default'}
        />
      </Dropdown>
      <NavToolbarSeparator />
    </>
  );
}
