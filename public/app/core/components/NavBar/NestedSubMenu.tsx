import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Icon, IconName, Link, useStyles2 } from '@grafana/ui';
import React, { FC } from 'react';

interface Props {
  items?: NavModelItem[];
}

export const NestedSubMenu: FC<Props> = ({ items = [] }) => {
  const styles = useStyles2(getStyles);
  return (
    <ul className={styles.menu}>
      {items.map((item) => (
        <li key={item.id}>
          <Link href={item.url || '#'} target={item.target} data-testid={`left-menu-${item.id}`}>
            {item.icon && <Icon name={item.icon as IconName} className={styles.icon} />}
            {item.text}
          </Link>
          {!!item.children?.length && !!item.children.find((child) => !child.hideFromMenu) && (
            <>
              <span style={{ marginLeft: 'auto' }}>{<Icon name={'angle-right'} />}</span>
              <NestedSubMenu items={item.children} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
};

const getStyles = ({ colors, components, spacing, zIndex }: GrafanaTheme2) => {
  return {
    menu: css`
      background-color: ${colors.background.primary};
      border: 1px solid ${components.panel.borderColor};
      position: absolute;
      top: 0;
      left: 100%;
      min-width: 140px;
      list-style: none;
      opacity: 0;
      visibility: hidden;
      z-index: ${zIndex.sidemenu};

      & > li {
        position: relative;
        cursor: pointer;
        display: flex;
        align-items: center;
        text-align: left;

        & > a {
          width: 100%;
          padding: 5px 12px 5px 10px;
          white-space: nowrap;
        }

        &:hover {
          background-color: ${colors.action.hover};
          & > ul {
            opacity: 1;
            visibility: visible;
          }
        }
      }
    `,
    icon: css`
      margin-right: ${spacing(1)};
    `,
  };
};
