import { useState } from 'react';

import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';

import { getComponentIdFromComponentMeta, useExtensionSidebarContext } from './ExtensionSidebarProvider';

export function ExtensionToolbarItem() {
  const [isOpen, setIsOpen] = useState(false);
  const { availableComponents, dockedComponentId, setDockedComponentId } = useExtensionSidebarContext();

  if (availableComponents.size === 0) {
    return null;
  }

  // get a flat list of all components with their pluginId
  const components = Array.from(availableComponents.entries()).flatMap(([pluginId, { exposedComponents }]) =>
    exposedComponents.map((c) => ({ ...c, pluginId }))
  );

  if (components.length === 0) {
    return null;
  }

  if (components.length === 1) {
    return (
      <ToolbarButton
        icon="web-section"
        variant={dockedComponentId ? 'active' : 'default'}
        tooltip={components[0].description}
        onClick={() => {
          setDockedComponentId(getComponentIdFromComponentMeta(components[0].pluginId, components[0]));
        }}
      />
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
              setDockedComponentId(dockedComponentId === id ? undefined : id);
            }}
          />
        );
      })}
    </Menu>
  );
  return (
    <Dropdown overlay={MenuItems} onVisibleChange={setIsOpen} placement="bottom-end">
      <ToolbarButton icon="web-section" isOpen={isOpen} variant={dockedComponentId ? 'active' : 'default'} />
    </Dropdown>
  );
}
