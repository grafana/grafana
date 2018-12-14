import React, { SFC } from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

interface ExtendedOptionProps extends OptionProps<any> {
  data: any;
}

const UnitOption: SFC<ExtendedOptionProps> = props => {
  const { children, isSelected, className } = props;

  return (
    <components.Option {...props}>
      <div className={`unit-picker-option__button btn btn-link ${className}`}>
        {isSelected && <i className="fa fa-check pull-right" aria-hidden="true" />}
        <div className="gf-form">{children}</div>
      </div>
    </components.Option>
  );
};

export default UnitOption;
