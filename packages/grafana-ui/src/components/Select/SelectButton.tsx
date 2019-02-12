import React, { FunctionComponent } from 'react';

export interface Props {
  value: string | undefined;
  textWhenUndefined: string;
  iconClass?: string;
  onClick: () => void;
}

export const SelectButton: FunctionComponent<Props> = (props: Props) => {
  return (
    <button className="btn navbar-button navbar-button--tight" onClick={props.onClick}>
      <div className="select-button">
        {props.iconClass && <i className={`select-button-icon ${props.iconClass}`} />}
        <span className="select-button-value">{props.value ? props.value : props.textWhenUndefined}</span>
        <i className="fa fa-caret-down fa-fw" />
      </div>
    </button>
  );
};
