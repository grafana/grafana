import { css } from '@emotion/css';
import React from 'react';

import { DataLink, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Dropdown, Icon, Menu, ToolbarButton, useStyles2 } from '@grafana/ui';
import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/src/themes/mixins';

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
          return <Menu.Item key={idx} label={link.title} url={link.href} target={link.target} />;
        })}
      </Menu>
    );
  };

  if (panelLinks.length === 1) {
    const linkModel = onShowPanelLinks()[0];
    return (
      <a
        href={linkModel.href}
        onClick={linkModel.onClick}
        target={linkModel.target}
        title={linkModel.title}
        className={styles.singleLink}
      >
        <Icon name="external-link-alt" size="lg" />
      </a>
    );
  } else {
    return (
      <Dropdown overlay={getLinksContent}>
        <ToolbarButton icon="external-link-alt" aria-label="panel links" className={styles.menuTrigger} />
      </Dropdown>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    menuTrigger: css({
      border: 'none',
      borderRadius: theme.shape.borderRadius(0),
      cursor: 'context-menu',
    }),
    singleLink: css({
      color: theme.colors.text.secondary,
      padding: `${theme.spacing(0, 1)}`,
      height: ` ${theme.spacing(theme.components.height.md)}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },
      '&: focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&:hover ': {
        boxShadow: `${theme.shadows.z1}`,
        color: `${theme.colors.text.primary}`,
        background: `${theme.colors.background.secondary}`,
      },
    }),
  };
};
