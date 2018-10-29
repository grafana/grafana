import React, { SFC } from 'react';

interface Props {
  onValueChange: any;
  options: any;
  value: string;
  label: string;
}

const SimpleDropdown: SFC<Props> = props => {
  return (
    <div className="gf-form max-width-21">
      <span className="gf-form-label width-7">{props.label}</span>
      <div className="gf-form-select-wrapper max-width-14">
        <select className="gf-form-input" required onChange={props.onValueChange}>
          {props.options.map((qt, i) => (
            <option key={i} value={qt} ng-if="false">
              {qt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default SimpleDropdown;
