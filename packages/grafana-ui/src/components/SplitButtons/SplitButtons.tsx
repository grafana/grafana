import React, { FC } from 'react';
import { css } from 'emotion';
export interface SplitButtonsProps {
  children: any;
}

const wrapper = css`
  > div {
    display: inline-block;
  }

  > *:last-child:not(:first-child),
  > div:last-child:not(:first-child) > button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  > *:first-child:not(:last-child),
  > div:first-child:not(:last-child) > button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  > *:not(:first-child):not(:last-child),
  > div:not(:first-child):not(:last-child) > button {
    border-radius: 0;
  }
`;

export const SplitButtons: FC<SplitButtonsProps> = ({ children, ...restProps }) => {
  // const newChildren = React.Children.map(children, (child, i) =>
  //   React.cloneElement(child, { className: getStyles(children.length, i) })
  // );

  return (
    <div {...restProps} className={wrapper}>
      {children}
    </div>
  );
};
