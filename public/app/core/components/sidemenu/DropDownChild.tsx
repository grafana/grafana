import React, { FC } from 'react';
import { css } from '@emotion/css';
import { Icon, IconName, Link, useTheme } from '@grafana/ui';

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

  const linkContent = (
    <>
      {child.icon && <Icon name={child.icon as IconName} className={iconClassName} />}
      {child.text}
    </>
  );

  const anchor = child.url ? <Link href={child.url}>{linkContent}</Link> : <a>{linkContent}</a>;

  return <li className={listItemClassName}>{anchor}</li>;
};

export default DropDownChild;
