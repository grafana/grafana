import React, { PureComponent, SyntheticEvent } from 'react';
import { SelectOptionItem } from './Select';
import { SelectButton } from './SelectButton';
import { HeadlessSelect } from './HeadlessSelect';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

export interface Props {
  className: string | undefined;
  options: SelectOptionItem[];
  value: SelectOptionItem;
  label: string;
  iconClass?: string;
  components?: any;
  maxMenuHeight?: number;
  onChange: (item: SelectOptionItem) => void;
  onOutsideClick?: (event: SyntheticEvent) => boolean;
}

export interface State {
  isSelectOpen: boolean;
}

export class ButtonSelect extends PureComponent<Props, State> {
  state: State = { isSelectOpen: false };
  onChange = (item: SelectOptionItem) => {
    const { onChange } = this.props;
    onChange(item);
    this.setState({ isSelectOpen: false });
  };

  onClick = () => {
    this.setState({ isSelectOpen: !this.state.isSelectOpen });
  };

  onClickOutside = () => {
    this.setState({ isSelectOpen: false });
  };

  render() {
    const { className, options, value, label, iconClass, components, onOutsideClick, maxMenuHeight } = this.props;
    const { isSelectOpen } = this.state;

    return (
      <ClickOutsideWrapper onClick={this.onClickOutside} onOutsideClick={onOutsideClick}>
        <div className={className}>
          <div className={`${className}-button`}>
            <SelectButton onClick={this.onClick} iconClass={iconClass} value={label} textWhenUndefined="" />
          </div>
          <div className={`${className}-select`}>
            <HeadlessSelect
              options={options}
              onChange={this.onChange}
              value={value}
              components={components}
              isOpen={isSelectOpen}
              maxMenuHeight={maxMenuHeight}
            />
          </div>
        </div>
      </ClickOutsideWrapper>
    );
  }
}
