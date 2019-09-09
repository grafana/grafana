import React, { PureComponent, ReactElement } from 'react';
import Select from './Select';
import { PopoverContent } from '../Tooltip/Tooltip';
import { SelectableValue } from '@grafana/data';

interface ButtonComponentProps {
  label: ReactElement | string | undefined;
  className: string | undefined;
  iconClass?: string;
}

const ButtonComponent = (buttonProps: ButtonComponentProps) => (props: any) => {
  const { label, className, iconClass } = buttonProps;

  return (
    <button
      ref={props.innerRef}
      className={`btn navbar-button navbar-button--tight ${className}`}
      onClick={props.selectProps.menuIsOpen ? props.selectProps.onMenuClose : props.selectProps.onMenuOpen}
      onBlur={props.selectProps.onMenuClose}
    >
      <div className="select-button">
        {iconClass && <i className={`select-button-icon ${iconClass}`} />}
        <span className="select-button-value">{label ? label : ''}</span>
        {!props.menuIsOpen && <i className="fa fa-caret-down fa-fw" />}
        {props.menuIsOpen && <i className="fa fa-caret-up fa-fw" />}
      </div>
    </button>
  );
};

export interface Props<T> {
  className: string | undefined;
  options: Array<SelectableValue<T>>;
  value?: SelectableValue<T>;
  label?: ReactElement | string;
  iconClass?: string;
  components?: any;
  maxMenuHeight?: number;
  onChange: (item: SelectableValue<T>) => void;
  tooltipContent?: PopoverContent;
  isMenuOpen?: boolean;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
  tabSelectsValue?: boolean;
  autoFocus?: boolean;
}

export class ButtonSelect<T> extends PureComponent<Props<T>> {
  onChange = (item: SelectableValue<T>) => {
    const { onChange } = this.props;
    onChange(item);
  };

  render() {
    const {
      className,
      options,
      value,
      label,
      iconClass,
      components,
      maxMenuHeight,
      tooltipContent,
      isMenuOpen,
      onOpenMenu,
      onCloseMenu,
      tabSelectsValue,
      autoFocus = true,
    } = this.props;
    const combinedComponents = {
      ...components,
      Control: ButtonComponent({ label, className, iconClass }),
    };

    return (
      <Select
        autoFocus={autoFocus}
        backspaceRemovesValue={false}
        isClearable={false}
        isSearchable={false}
        options={options}
        onChange={this.onChange}
        value={value}
        isOpen={isMenuOpen}
        onOpenMenu={onOpenMenu}
        onCloseMenu={onCloseMenu}
        maxMenuHeight={maxMenuHeight}
        components={combinedComponents}
        className="gf-form-select-box-button-select"
        tooltipContent={tooltipContent}
        tabSelectsValue={tabSelectsValue}
      />
    );
  }
}
