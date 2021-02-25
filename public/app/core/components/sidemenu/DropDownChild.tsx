import React, { FC } from 'react';
import { css } from 'emotion';
import { Icon, IconName, useTheme } from '@grafana/ui';

export interface Props {
  child: any;
}

const DropDownChild: FC<Props> = (props) => {
  const { child } = props;
  const listItemClassName = child.divider ? 'divider' : '';
  const theme = useTheme();
  const iconClassName = css`
    margin-right: ${theme.spacing.sm};
  `;

  const children = (child.children || []).map((child: any, index: number) => {
    return <DropDownChild child={child} key={`${child.url}-${index}`} />;
  });

  const renderChildren = !!children.length;
  return (
    <li className={listItemClassName}>
      <a href={child.url}>
        {child.icon && <Icon name={child.icon as IconName} className={iconClassName} />}
        {child.text}
        <span style={{ marginLeft: 'auto' }}>{renderChildren && <Icon name={'angle-right'} />}</span>
      </a>
      {renderChildren && <ul className="sidemenu dropdown-menu--sidemenu submenu">{children}</ul>}
    </li>
  );
};

export default DropDownChild;
