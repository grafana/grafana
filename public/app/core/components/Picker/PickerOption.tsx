import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';

// https://github.com/JedWatson/react-select/issues/3038
interface ExtendedOptionProps extends OptionProps<any> {
  data: {
    description?: string;
    imgUrl?: string;
  };
}

export const Option = (props: ExtendedOptionProps) => {
  const { children, isSelected, data } = props;

  return (
    <components.Option {...props}>
      <div className="gf-form-select-box__desc-option">
        {data.imgUrl && <img className="gf-form-select-box__desc-option__img" src={data.imgUrl} />}
        <div className="gf-form-select-box__desc-option__body">
          <div>{children}</div>
          {data.description && <div className="gf-form-select-box__desc-option__desc">{data.description}</div>}
        </div>
        {isSelected && <i className="fa fa-check" aria-hidden="true" />}
      </div>
    </components.Option>
  );
};

export const SingleValue = (props: ExtendedOptionProps) => {
  const { children, data } = props;

  return (
    <components.SingleValue {...props}>
      <div className="gf-form-select-box__img-value">
        {data.imgUrl && <img className="gf-form-select-box__desc-option__img" src={data.imgUrl} />}
        {children}
      </div>
    </components.SingleValue>
  );
};

export default Option;
