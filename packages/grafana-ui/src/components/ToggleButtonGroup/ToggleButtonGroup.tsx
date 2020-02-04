import React, { FC, ReactNode, PureComponent } from 'react';
import classNames from 'classnames';
import { Tooltip } from '../Tooltip/Tooltip';

interface ToggleButtonGroupProps {
  label?: string;
  children: JSX.Element[];
  transparent?: boolean;
  width?: number;
}

export class ToggleButtonGroup extends PureComponent<ToggleButtonGroupProps> {
  render() {
    const { children, label, transparent, width } = this.props;
    const labelClasses = classNames('gf-form-label', {
      'gf-form-label--transparent': transparent,
      [`width-${width}`]: width,
    });
    const buttonGroupClasses = classNames('toggle-button-group', {
      'toggle-button-group--transparent': transparent,
      'toggle-button-group--padded': width, // Add extra padding to compensate for buttons border
    });

    return (
      <div className="gf-form gf-form--align-center">
        {label && <label className={labelClasses}>{label}</label>}
        <div className={buttonGroupClasses}>{children}</div>
      </div>
    );
  }
}

interface ToggleButtonProps {
  onChange?: (value: any) => void;
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
  const onClick = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (!selected && onChange) {
      onChange(value);
    }
  };

  const btnClassName = `btn ${className}${selected ? ' active' : ''}`;
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
