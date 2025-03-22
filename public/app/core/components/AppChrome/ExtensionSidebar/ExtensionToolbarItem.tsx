import { useState } from 'react';

import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';

import { useExtensionSidebarContext } from './ExtensionSidebarProvider';

export function ExtensionToolbarItem() {
  const [isOpen, setIsOpen] = useState(false);
  const { components, dockedPluginId, setDockedPluginId } = useExtensionSidebarContext();

  if (components.size === 0) {
    return null;
  }

  if (components.size === 1) {
    const component = components.values().next().value;
    return (
      <ToolbarButton
        icon="web-section"
        variant={dockedPluginId ? 'active' : 'default'}
        tooltip={component?.meta.description}
        onClick={() => {
          setDockedPluginId(dockedPluginId === component?.meta.pluginId ? undefined : component?.meta.pluginId);
        }}
      />
    );
  }

  const MenuItems = (
    <Menu>
      {Array.from(components.values()).map((c) => (
        <Menu.Item
          key={c.meta.pluginId}
          active={dockedPluginId === c.meta.pluginId}
          label={c.meta.title}
          onClick={() => {
            setDockedPluginId(dockedPluginId === c.meta.pluginId ? undefined : c.meta.pluginId);
          }}
        />
      ))}
    </Menu>
  );
  return (
    <Dropdown overlay={MenuItems} onVisibleChange={setIsOpen} placement="bottom-end">
      <ToolbarButton icon="web-section" isOpen={isOpen} variant={dockedPluginId ? 'active' : 'default'} />
    </Dropdown>
  );
}
