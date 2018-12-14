// Libraries
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { default as ReactSelect } from 'react-select';

// Components
import DescriptionOption from './DescriptionOption';
import IndicatorsContainer from './IndicatorsContainer';
import ResetStyles from './ResetStyles';

export interface SelectOptionItem {
  label?: string;
  value?: string;
  imgUrl?: string;
  description?: string;
  [key: string]: any;
}

interface Props {
  defaultValue?: any;
  getOptionLabel?: (item: SelectOptionItem) => string;
  getOptionValue?: (item: SelectOptionItem) => string;
  onChange: (item: SelectOptionItem) => {} | void;
  options: SelectOptionItem[];
  placeholder?: string;
  width?: number;
  value: SelectOptionItem;
  className?: string;
  components: object;
}

export class Select extends PureComponent<Props> {
  static defaultProps = {
    width: null,
    className: '',
    components: {},
  };

  render() {
    const {
      defaultValue,
      getOptionLabel,
      getOptionValue,
      onChange,
      options,
      placeholder,
      width,
      value,
      className,
    } = this.props;

    let widthClass = '';
    if (width) {
      widthClass = 'width-' + width;
    }

    const selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);

    return (
      <ReactSelect
        classNamePrefix="gf-form-select-box"
        className={selectClassNames}
        components={{
          Option: DescriptionOption,
          IndicatorsContainer,
        }}
        defaultValue={defaultValue}
        value={value}
        getOptionLabel={getOptionLabel}
        getOptionValue={getOptionValue}
        menuShouldScrollIntoView={false}
        isSearchable={false}
        onChange={onChange}
        options={options}
        placeholder={placeholder || 'Choose'}
        styles={ResetStyles}
      />
    );
  }
}

export default Select;
