import React from 'react';
import { Tooltip } from '../Tooltip/Tooltip';
import { DisplayValue } from '../../utils/index';
import * as PopperJS from 'popper.js';

export interface DisplayValueProps {
  value: DisplayValue;
  children: JSX.Element;
  placement?: PopperJS.Placement;
}

export const DisplayValueLink = ({ placement, children, value }: DisplayValueProps) => {
  const { tooltip, link } = value;
  if (!tooltip && !link) {
    return children;
  }

  // If we want it to follow the mouse, we don't use popper
  const body = tooltip ? (
    <Tooltip theme="info" placement={placement ? placement : 'top'} content={tooltip}>
      {children}
    </Tooltip>
  ) : (
    children
  );

  if (link) {
    if (typeof link === 'string') {
      return (
        <a className="display-value-link" href={link}>
          {body}
        </a>
      );
    }
    return (
      <a className="display-value-link" href="#" onClick={link}>
        {body}
      </a>
    );
  }
  return body;
};
