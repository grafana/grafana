import React from 'react';

import { LinkModel } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';

interface VizPanelLinksState extends SceneObjectState {
  links?: LinkModel[];
  menu: VizPanelLinksMenu;
}

export class VizPanelLinks extends SceneObjectBase<VizPanelLinksState> {
  static Component = VizPanelLinksRenderer;
}

function VizPanelLinksRenderer({ model }: SceneComponentProps<VizPanelLinks>) {
  const { menu } = model.useState();

  return (
    <Dropdown
      overlay={() => {
        return <menu.Component model={menu} key={menu.state.key} />;
      }}
    >
      <ToolbarButton icon="external-link-alt" iconSize="md" aria-label="panel links" />
    </Dropdown>
  );
}

export class VizPanelLinksMenu extends SceneObjectBase<Omit<VizPanelLinksState, 'menu'>> {
  static Component = VizPanelLinksMenuRenderer;
}

function VizPanelLinksMenuRenderer({ model }: SceneComponentProps<VizPanelLinks>) {
  const { links } = model.useState();

  if (!links) {
    return null;
  }

  return (
    <Menu>
      {links?.map((link, idx) => {
        return <Menu.Item key={idx} label={link.title} url={link.href} target={link.target} onClick={link.onClick} />;
      })}
    </Menu>
  );
}
