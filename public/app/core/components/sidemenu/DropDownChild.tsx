import React from 'react';
import { css } from '@emotion/css';
import { Icon, IconName, Link, useTheme2 } from '@grafana/ui';

export interface Props {
  isDivider?: boolean;
  icon?: IconName;
  onClick?: () => void;
  target?: HTMLAnchorElement['target'];
  text: string;
  url?: string;
}

const DropDownChild = ({ isDivider = false, icon, onClick, target, text, url }: Props) => {
  const theme = useTheme2();
  const iconClassName = css`
    margin-right: ${theme.spacing(1)};
  `;
  const resetButtonStyles = css`
    background-color: transparent;
    border: none;
    width: 100%;
  `;

  const linkContent = (
    <>
      {icon && <Icon data-testid="dropdown-child-icon" name={icon} className={iconClassName} />}
      {text}
    </>
  );

  let element = (
    <button className={resetButtonStyles} onClick={onClick}>
      {linkContent}
    </button>
  );
  if (url) {
    element =
      !target && url.startsWith('/') ? (
        <Link onClick={onClick} href={url}>
          {linkContent}
        </Link>
      ) : (
        <a href={url} target={target} rel="noopener" onClick={onClick}>
          {linkContent}
        </a>
      );
  }

  return isDivider ? <li data-testid="dropdown-child-divider" className="divider" /> : <li>{element}</li>;
};

export default DropDownChild;
