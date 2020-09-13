import React, { forwardRef } from 'react';
import { IconName, Icon } from '@grafana/ui';

export enum IconSide {
  left = 'left',
  right = 'right',
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  splitted: boolean;
  title: string;
  onClick?: () => void;
  buttonClassName?: string;
  icon?: IconName;
  iconClassName?: string;
  iconSide?: IconSide;
  disabled?: boolean;
}

function formatBtnTitle(title: string, iconSide?: string): string {
  return iconSide === IconSide.left ? '\xA0' + title : iconSide === IconSide.right ? title + '\xA0' : title;
}

export const ResponsiveButton = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const defaultProps = {
    iconSide: IconSide.left,
  };

  props = { ...defaultProps, ...props };
  const {
    title,
    onClick,
    buttonClassName,
    icon,
    iconClassName,
    splitted,
    iconSide,
    disabled,
    ...divElementProps
  } = props;

  return (
    <div {...divElementProps}>
      <button
        ref={ref}
        className={`btn navbar-button ${buttonClassName ? buttonClassName : ''}`}
        onClick={onClick ?? undefined}
        disabled={disabled || false}
      >
        {icon && iconSide === IconSide.left ? <Icon name={icon} className={iconClassName} size="lg" /> : null}
        <span className="btn-title">{!splitted ? formatBtnTitle(title, iconSide) : ''}</span>
        {icon && iconSide === IconSide.right ? <Icon name={icon} className={iconClassName} size="lg" /> : null}
      </button>
    </div>
  );
});
