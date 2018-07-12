import React, { SFC, ReactNode } from 'react';
import Tooltip from '../Tooltip/Tooltip';

interface Props {
  tooltip?: string;
  for?: string;
  children: ReactNode;
}

export const Label: SFC<Props> = props => {
  return (
    <span className="gf-form-label width-10">
      <span>{props.children}</span>
      {props.tooltip && (
        <Tooltip className="gf-form-help-icon--right-normal" placement="auto" content="hello">
          <i className="gicon gicon-question gicon--has-hover" />
        </Tooltip>
      )}
    </span>
  );
};
