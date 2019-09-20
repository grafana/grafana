import React from 'react';

export enum IconSide {
  left = 'left',
  right = 'right',
}

type Props = {
  splitted: boolean;
  title: string;
  onClick: () => void;
  buttonClassName?: string;
  iconClassName?: string;
  iconSide?: IconSide;
  disabled?: boolean;
};

export const ResponsiveButton = (props: Props) => {
  const defaultProps = {
    iconSide: IconSide.left,
  };
  props = { ...defaultProps, ...props };
  const { title, onClick, buttonClassName, iconClassName, splitted, iconSide, disabled } = props;

  return (
    <button
      className={`btn navbar-button ${buttonClassName ? buttonClassName : ''}`}
      onClick={onClick}
      disabled={disabled || false}
    >
      {iconClassName && iconSide === IconSide.left ? (
        <>
          <i className={`${iconClassName}`} />
          &nbsp;
        </>
      ) : null}
      <span className="btn-title">{!splitted ? title : ''}</span>
      {iconClassName && iconSide === IconSide.right ? (
        <>
          &nbsp;
          <i className={`${iconClassName}`} />
        </>
      ) : null}
    </button>
  );
};
