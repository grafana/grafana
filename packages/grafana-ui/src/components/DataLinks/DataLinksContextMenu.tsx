import { css } from '@emotion/css';
import { type CSSProperties, type JSX } from 'react';
import * as React from 'react';

import { type ActionModel, type GrafanaTheme2, type LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { linkModelToContextMenuItems } from '../../utils/dataLinks';
import { WithContextMenu } from '../ContextMenu/WithContextMenu';
import { MenuGroup, type MenuItemsGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';

export interface DataLinksContextMenuProps {
  children: (props: DataLinksContextMenuApi) => JSX.Element;
  links: () => LinkModel[];
  style?: CSSProperties;
  /**
   * @deprecated Will be removed in a future version
   */
  actions?: ActionModel[];
}

export interface DataLinksContextMenuApi {
  openMenu?: React.MouseEventHandler<HTMLOrSVGElement>;
  targetClassName?: string;
}

export const DataLinksContextMenu = ({ children, links, style }: DataLinksContextMenuProps) => {
  const styles = useStyles2(getStyles);

  const itemsGroup: MenuItemsGroup[] = [
    { items: linkModelToContextMenuItems(links), label: Boolean(links().length) ? 'Data links' : '' },
  ];

  const linksCounter = itemsGroup[0].items.length;
  const renderMenuGroupItems = () => {
    return itemsGroup.map((group, groupIdx) => (
      <MenuGroup key={`${group.label}${groupIdx}`} label={group.label}>
        {(group.items || []).map((item, itemIdx) => (
          <MenuItem
            key={`${group.label}-${groupIdx}-${itemIdx}}`}
            url={item.url}
            label={item.label}
            target={item.target}
            icon={item.icon}
            active={item.active}
            onClick={item.onClick}
            className={styles.itemWrapper}
          />
        ))}
      </MenuGroup>
    ));
  };

  // Use this class name (exposed via render prop) to add context menu indicator to the click target of the visualization
  const targetClassName = styles.menuTarget;

  if (linksCounter > 1) {
    return (
      <WithContextMenu renderMenuItems={renderMenuGroupItems}>
        {({ openMenu }) => {
          return children({ openMenu, targetClassName });
        }}
      </WithContextMenu>
    );
  } else {
    const linkModel = links()[0];
    return (
      <a
        href={linkModel.href}
        onClick={linkModel.onClick}
        target={linkModel.target}
        title={linkModel.title}
        style={{ ...style, overflow: 'hidden', display: 'flex' }}
        data-testid={selectors.components.DataLinksContextMenu.singleLink}
        className={styles.link}
      >
        {children({})}
      </a>
    );
  }
};

const getStyles = (theme: GrafanaTheme2) => ({
  itemWrapper: css({
    fontSize: 12,
  }),
  link: css({
    '&:focus, &:focus-visible': getFocusStyles(theme),
  }),
  menuTarget: css({
    cursor: 'context-menu',
    '&:focus, &:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '2px',
    },
  }),
});
