import React from 'react';
import { components } from 'react-select';
import { OptionProps } from 'react-select/lib/components/Option';
import { TagBadge } from './TagBadge';

// https://github.com/JedWatson/react-select/issues/3038
interface ExtendedOptionProps extends OptionProps<any> {
  data: any;
}

export const TagOption = (props: ExtendedOptionProps) => {
  const { data, className, label } = props;
  return (
    <components.Option {...props}>
      <div className={`tag-filter-option btn btn-link ${className || ''}`}>
        <TagBadge label={label} removeIcon={true} count={data.count} />
      </div>
    </components.Option>
  );
};

export default TagOption;

// import React from 'react';
// import { TagBadge } from './TagBadge';

// export interface Props {
//   onSelect: any;
//   onFocus: any;
//   option: any;
//   isFocused: any;
//   className: any;
// }

// export class TagOption extends React.Component<Props, any> {
//   constructor(props) {
//     super(props);
//     this.handleMouseDown = this.handleMouseDown.bind(this);
//     this.handleMouseEnter = this.handleMouseEnter.bind(this);
//     this.handleMouseMove = this.handleMouseMove.bind(this);
//   }

//   handleMouseDown(event) {
//     event.preventDefault();
//     event.stopPropagation();
//     this.props.onSelect(this.props.option, event);
//   }

//   handleMouseEnter(event) {
//     this.props.onFocus(this.props.option, event);
//   }

//   handleMouseMove(event) {
//     if (this.props.isFocused) {
//       return;
//     }
//     this.props.onFocus(this.props.option, event);
//   }

//   render() {
//     const { option, className } = this.props;

//     return (
//       <button
//         onMouseDown={this.handleMouseDown}
//         onMouseEnter={this.handleMouseEnter}
//         onMouseMove={this.handleMouseMove}
//         title={option.title}
//         className={`tag-filter-option btn btn-link ${className || ''}`}
//       >
//         <TagBadge label={option.label} removeIcon={false} count={option.count} onClick={this.handleMouseDown} />
//       </button>
//     );
//   }
// }
