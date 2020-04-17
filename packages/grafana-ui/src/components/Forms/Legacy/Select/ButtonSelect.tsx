import React, { PureComponent, ReactElement } from 'react';
import Select from './Select';
import { PopoverContent } from '../../../Tooltip/Tooltip';
import { Icon } from '../../../Icon/Icon';
import { IconName } from '../../../../types';
import { SelectableValue } from '@grafana/data';

interface ButtonComponentProps {
  label: ReactElement | string | undefined;
  className: string | undefined;
  iconClass?: string;
}

const ButtonComponent = (buttonProps: ButtonComponentProps) => (props: any) => {
  const { label, className, iconClass } = buttonProps;

  return (
    <div // changed to div because of FireFox on MacOs issue below
      ref={props.innerRef}
      className={`btn navbar-button navbar-button--tight ${className}`}
      onClick={props.selectProps.menuIsOpen ? props.selectProps.onMenuClose : props.selectProps.onMenuOpen}
      onBlur={props.selectProps.onMenuClose}
      tabIndex={0} // necessary to get onBlur to work https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#Clicking_and_focus
    >
      <div className="select-button">
        {iconClass && <Icon className={'select-button-icon'} name={iconClass as IconName} size="lg" />}
        <span className="select-button-value">{label ? label : ''}</span>
        {!props.menuIsOpen && <Icon name="angle-down" style={{ marginBottom: 0 }} size="lg" />}
        {props.menuIsOpen && <Icon name="angle-up" style={{ marginBottom: 0 }} size="lg" />}
      </div>
    </div>
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
