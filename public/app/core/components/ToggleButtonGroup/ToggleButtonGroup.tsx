import React, { SFC, ReactNode, PureComponent } from 'react';

interface ToggleButtonGroupProps {
  label?: string;
  children: JSX.Element[];
  transparent?: boolean;
}

export default class ToggleButtonGroup extends PureComponent<ToggleButtonGroupProps> {
  render() {
    const { children, label, transparent } = this.props;

    return (
      <div className="gf-form">
        {label && <label className={`gf-form-label ${transparent ? 'gf-form-label--transparent' : ''}`}>{label}</label>}
        <div className={`toggle-button-group ${transparent ? 'toggle-button-group--transparent' : ''}`}>{children}</div>
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
