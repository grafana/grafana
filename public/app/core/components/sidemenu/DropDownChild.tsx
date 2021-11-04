import React, { FC, useCallback } from 'react';
import { css, cx } from 'emotion';
import { Icon, IconName, useTheme } from '@grafana/ui';
import { getLinkSrv } from '../../../features/panel/panellinks/link_srv';

export interface Props {
  child: any;
}

const DropDownChild: FC<Props> = (props) => {
  const { child } = props;
  const listItemClassName = child.divider ? 'divider' : '';
  const linkClass = css`
    a[href^='#'] {
      cursor: default;
    }
  `;
  const theme = useTheme();
  const iconClassName = css`
    margin-right: ${theme.spacing.sm};
  `;

  const children = (child.children || []).map((child: any, index: number) => {
    return <DropDownChild child={child} key={`${child.url}-${index}`} />;
  });

  const onLinkMouseDown = useCallback(
    (e: any) => {
      if (String(child.url).match('/d/')) {
        const variableUrl = getLinkSrv().getLinkUrl({
          url: child.url,
          keepTime: true,
          includeVars: true,
        });
        e.target.href = variableUrl;
      } else {
        e.target.href = child.url;

        if (!child.url) {
          e.target.href = '#';
        }
      }

      return false;
    },
    [child.url]
  );

  const renderChildren = !!children.length;
  return (
    <li className={cx(listItemClassName, linkClass)} data-testid={`sidemenu-item-${child.id}`}>
      <a href={child.url || '#'} onMouseDown={onLinkMouseDown}>
        {child.icon && <Icon name={child.icon as IconName} className={iconClassName} />}
        {child.text}
        <span style={{ marginLeft: 'auto' }}>{renderChildren && <Icon name={'angle-right'} />}</span>
      </a>
      {renderChildren && <ul className="sidemenu dropdown-menu--sidemenu submenu">{children}</ul>}
    </li>
  );
};

export default DropDownChild;
