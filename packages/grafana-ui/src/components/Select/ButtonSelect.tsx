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
    <div className={`${className}-button`}>
      <button
        ref={props.innerRef}
        className="btn navbar-button navbar-button--tight"
        onClick={props.selectProps.menuIsOpen ? props.selectProps.onMenuClose : props.selectProps.onMenuOpen}
        onBlur={props.selectProps.onMenuClose}
      >
        <div className="select-button">
          {iconClass && <i className={`select-button-icon ${iconClass}`} />}
          <span className="select-button-value">{label ? label : ''}</span>
          <i className="fa fa-caret-down fa-fw" />
        </div>
      </button>
    </div>
  );
};

export interface Props {
  className: string | undefined;
  options: SelectOptionItem[];
  value: SelectOptionItem;
  label: string;
  iconClass?: string;
  components?: any;
  maxMenuHeight?: number;
  onChange: (item: SelectOptionItem) => void;
  tooltipContent?: PopperContent<any>;
}

export class ButtonSelect extends PureComponent<Props> {
  onChange = (item: SelectOptionItem) => {
    const { onChange } = this.props;
    onChange(item);
  };

  render() {
    const { className, options, value, label, iconClass, components, maxMenuHeight, tooltipContent } = this.props;
    const combinedComponents = {
      ...components,
      Control: ButtonComponent({ label, className, iconClass }),
    };

    return (
      <div className={className}>
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
        />
      </div>
    );
  }
}
