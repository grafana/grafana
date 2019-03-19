import React, { FC, ReactNode, PureComponent } from 'react';
import { Tooltip } from '@grafana/ui';

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
  tooltip?: string;
}

export const ToggleButton: FC<ToggleButtonProps> = ({
  children,
  selected,
  className = '',
  value = null,
  tooltip,
  onChange,
}) => {
  const onClick = event => {
    event.stopPropagation();
    if (onChange) {
      onChange(value);
    }
  };

  const btnClassName = `btn ${className} ${selected ? 'active' : ''}`;
  const button = (
    <button className={btnClassName} onClick={onClick}>
      <span>{children}</span>
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} placement="bottom">
        {button}
      </Tooltip>
    );
  } else {
    return button;
  }
};
