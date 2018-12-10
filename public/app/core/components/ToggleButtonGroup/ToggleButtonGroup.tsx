import React, { SFC, ReactNode, PureComponent, ReactElement } from 'react';

interface ToggleButtonGroupProps {
  onChange: (value) => void;
  value?: any;
  label?: string;
  render: (props) => void;
  stackedButtons?: boolean;
}

export default class ToggleButtonGroup extends PureComponent<ToggleButtonGroupProps> {
  static defaultProps = {
    stackedButtons: false,
  };

  getValues() {
    const { children } = this.props;
    return React.Children.toArray(children).map((c: ReactElement<any>) => c.props.value);
  }

  smallChildren() {
    const { children } = this.props;
    return React.Children.toArray(children).every((c: ReactElement<any>) => c.props.className.includes('small'));
  }

  handleToggle(toggleValue) {
    const { value, onChange } = this.props;
    if (value && value === toggleValue) {
      return;
    }
    onChange(toggleValue);
  }

  render() {
    const { value, label, stackedButtons } = this.props;
    const values = this.getValues();
    const selectedValue = value || values[0];
    const labelClassName = `gf-form-label ${this.smallChildren() ? 'small' : ''}`;

    return (
      <div className="gf-form">
        <div className={`toggle-button-group ${stackedButtons ? 'stacked' : ''}`}>
          {label && <label className={labelClassName}>{label}</label>}
          {this.props.render({ selectedValue, onChange: this.handleToggle.bind(this) })}
        </div>
      </div>
    );
  }
}

interface ToggleButtonProps {
  onChange?: (value) => void;
  selected?: boolean;
  value: any;
  className?: string;
  children: ReactNode;
}

export const ToggleButton: SFC<ToggleButtonProps> = ({ children, selected, className = '', value, onChange }) => {
  const handleChange = event => {
    event.stopPropagation();
    if (onChange) {
      onChange(value);
    }
  };

  const btnClassName = `btn ${className} ${selected ? 'active' : ''}`;
  return (
    <button className={btnClassName} onClick={handleChange}>
      <span>{children}</span>
    </button>
  );
};
