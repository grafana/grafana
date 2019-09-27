import React, { FC } from 'react';
import { cx, css } from 'emotion';

type Props = {
  className?: string;
  style?: React.CSSProperties;
  iconClassName?: string;
  inline?: boolean;
};
export const Spinner: FC<Props> = (props: Props) => {
  const { className, inline, iconClassName, style } = props;
  return (
    <div
      style={style}
      className={cx(
        {
          [css`
            display: inline-block;
          `]: inline,
        },
        className
      )}
    >
      <i className={cx('fa fa-spinner fa-spin', iconClassName)} />
    </div>
  );
};
