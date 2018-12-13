// import React, { PureComponent } from 'react';
// import Select as ReactSelect from 'react-select';
// import DescriptionOption from './DescriptionOption';
// import IndicatorsContainer from './IndicatorsContainer';
// import ResetStyles from './ResetStyles';
//
// export interface OptionType {
//   label: string;
//   value: string;
// }
//
// interface Props {
//   defaultValue?: any;
//   getOptionLabel: (item: T) => string;
//   getOptionValue: (item: T) => string;
//   onChange: (item: T) => {} | void;
//   options: T[];
//   placeholder?: string;
//   width?: number;
//   value: T;
//   className?: string;
// }
//
// export class Select<T> extends PureComponent<Props<T>> {
//   static defaultProps = {
//     width: null,
//     className: '',
//   }
//
//   render() {
//     const { defaultValue, getOptionLabel, getOptionValue, onSelected, options, placeholder, width, value, className } = this.props;
//     let widthClass = '';
//     if (width) {
//       widthClass = 'width-'+width;
//     }
//
//   return (
//     <ReactSelect
//       classNamePrefix="gf-form-select-box"
//       className={`gf-form-input gf-form-input--form-dropdown ${widthClass} ${className}`}
//       components={{
//         Option: DescriptionOption,
//         IndicatorsContainer,
//       }}
//       defaultValue={defaultValue}
//       value={value}
//       getOptionLabel={getOptionLabel}
//       getOptionValue={getOptionValue}
//       menuShouldScrollIntoView={false}
//       isSearchable={false}
//       onChange={onSelected}
//       options={options}
//       placeholder={placeholder || 'Choose'}
//       styles={ResetStyles}
//     />
//   );
// }
// }
//
// export default Select;
