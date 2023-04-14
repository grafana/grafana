import { css } from '@emotion/css';
import React from 'react';

import { DataLink, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Dropdown, Icon, Menu, ToolbarButton, useStyles2, PanelChrome } from '@grafana/ui';

interface Props {
  panelLinks: DataLink[];
  onShowPanelLinks: () => LinkModel[];
}

export function PanelLinks({ panelLinks, onShowPanelLinks }: Props) {
  const styles = useStyles2(getStyles);

  const getLinksContent = (): JSX.Element => {
    const interpolatedLinks = onShowPanelLinks();
    return (
      <Menu>
        {interpolatedLinks?.map((link, idx) => {
          return <Menu.Item key={idx} label={link.title} url={link.href} target={link.target} onClick={link.onClick} />;
        })}
      </Menu>
    );
  };

  if (panelLinks.length === 1) {
    const linkModel = onShowPanelLinks()[0];
    return (
      <PanelChrome.TitleItem
        href={linkModel.href}
        onClick={linkModel.onClick}
        target={linkModel.target}
        title={linkModel.title}
      >
        <Icon name="external-link-alt" size="md" />
      </PanelChrome.TitleItem>
    );
  } else {
    return (
      <Dropdown overlay={getLinksContent}>
        <ToolbarButton icon="external-link-alt" iconSize="md" aria-label="panel links" className={styles.menuTrigger} />
      </Dropdown>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    menuTrigger: css({
      height: '100%',
      background: 'inherit',
      border: 'none',
      borderRadius: `${theme.shape.borderRadius()}`,
      cursor: 'context-menu',
    }),
  };
};
