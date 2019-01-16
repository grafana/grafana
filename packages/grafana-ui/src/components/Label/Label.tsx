import React, { SFC, ReactNode } from 'react';
import { Tooltip } from '../Tooltip/Tooltip';

interface Props {
  tooltip?: string;
  for?: string;
  children: ReactNode;
  width?: number;
  className?: string;
}

export const Label: SFC<Props> = props => {
  return (
    <span className={`gf-form-label width-${props.width ? props.width : '10'}`}>
      <span>{props.children}</span>
      {props.tooltip && (
        <Tooltip placement="auto" content={props.tooltip}>
          <div className="gf-form-help-icon--right-normal">
            <i className="gicon gicon-question gicon--has-hover" />
          </div>
        </Tooltip>
      )}
    </span>
  );
};
