import React, { forwardRef } from 'react';

export enum IconSide {
  left = 'left',
  right = 'right',
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  splitted: boolean;
  title: string;
  onClick: () => void;
  buttonClassName?: string;
  iconClassName?: string;
  iconSide?: IconSide;
  disabled?: boolean;
}

function formatBtnTitle(title: string, iconSide?: string): string {
  return iconSide === IconSide.left ? '\xA0' + title : iconSide === IconSide.right ? title + '\xA0' : title;
}

export const ResponsiveButton = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const defaultProps = {
    iconSide: IconSide.left,
  };

  props = { ...defaultProps, ...props };
  const { title, onClick, buttonClassName, iconClassName, splitted, iconSide, disabled, ...divElementProps } = props;

  return (
    <div ref={ref} {...divElementProps}>
      <button
        className={`btn navbar-button ${buttonClassName ? buttonClassName : ''}`}
        onClick={onClick}
        disabled={disabled || false}
      >
        {iconClassName && iconSide === IconSide.left ? <i className={`${iconClassName}`} /> : null}
        <span className="btn-title">{!splitted ? formatBtnTitle(title, iconSide) : ''}</span>
        {iconClassName && iconSide === IconSide.right ? <i className={`${iconClassName}`} /> : null}
      </button>
    </div>
  );
});
