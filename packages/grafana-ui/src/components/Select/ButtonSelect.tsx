import React, { PureComponent } from 'react';
import Select, { SelectOptionItem } from './Select';
import { PopperContent } from '@grafana/ui/src/components/Tooltip/PopperController';

interface ButtonComponentProps {
  label: string | undefined;
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
        <i className="fa fa-caret-down fa-fw" />
      </div>
    </button>
  );
};

export interface Props<T> {
  className: string | undefined;
  options: Array<SelectOptionItem<T>>;
  value: SelectOptionItem<T>;
  label?: string;
  iconClass?: string;
  components?: any;
  maxMenuHeight?: number;
  onChange: (item: SelectOptionItem<T>) => void;
  tooltipContent?: PopperContent<any>;
  isMenuOpen?: boolean;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
}

export class ButtonSelect<T> extends PureComponent<Props<T>> {
  onChange = (item: SelectOptionItem<T>) => {
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
    } = this.props;
    const combinedComponents = {
      ...components,
      Control: ButtonComponent({ label, className, iconClass }),
    };
    return (
      <Select
        autoFocus
        backspaceRemovesValue={false}
        isClearable={false}
        isSearchable={false}
        options={options}
        onChange={this.onChange}
        defaultValue={value}
        maxMenuHeight={maxMenuHeight}
        components={combinedComponents}
        className="gf-form-select-box-button-select"
        tooltipContent={tooltipContent}
        isOpen={isMenuOpen}
        onOpenMenu={onOpenMenu}
        onCloseMenu={onCloseMenu}
      />
    );
  }
}
