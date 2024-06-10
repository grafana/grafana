import React from 'react';

import { DataLink, LinkModel } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Dropdown, Icon, Menu, PanelChrome, ToolbarButton } from '@grafana/ui';

import { getPanelLinks } from './PanelMenuBehavior';

interface VizPanelLinksState extends SceneObjectState {
  rawLinks?: DataLink[];
  links?: LinkModel[];
  menu: VizPanelLinksMenu;
}

export class VizPanelLinks extends SceneObjectBase<VizPanelLinksState> {
  static Component = VizPanelLinksRenderer;
}

function VizPanelLinksRenderer({ model }: SceneComponentProps<VizPanelLinks>) {
  const { menu, rawLinks } = model.useState();

  if (!(model.parent instanceof VizPanel)) {
    throw new Error('VizPanelLinks must be a child of VizPanel');
  }

  if (!rawLinks || rawLinks.length === 0) {
    return null;
  }

  if (rawLinks.length === 1) {
    const link = getPanelLinks(model.parent)[0];
    return (
      <PanelChrome.TitleItem href={link.href} onClick={link.onClick} target={link.target} title={link.title}>
        <Icon name="external-link-alt" size="md" />
      </PanelChrome.TitleItem>
    );
  }

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

export class VizPanelLinksMenu extends SceneObjectBase<Omit<VizPanelLinksState, 'menu' | 'rawLinks'>> {
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
