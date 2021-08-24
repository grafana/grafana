import React from 'react';
import { css } from '@emotion/css';
import { Icon, IconName, Link, useTheme2 } from '@grafana/ui';

export interface Props {
  isDivider?: boolean;
  icon?: IconName;
  text: string;
  url?: string;
}

const DropDownChild = ({ isDivider = false, icon, text, url }: Props) => {
  const theme = useTheme2();
  const iconClassName = css`
    margin-right: ${theme.spacing(1)};
  `;

  const linkContent = (
    <>
      {icon && <Icon data-testid="dropdown-child-icon" name={icon} className={iconClassName} />}
      {text}
    </>
  );

  const anchor = url ? <Link href={url}>{linkContent}</Link> : <a>{linkContent}</a>;

  return isDivider ? <li data-testid="dropdown-child-divider" className="divider" /> : <li>{anchor}</li>;
};

export default DropDownChild;
