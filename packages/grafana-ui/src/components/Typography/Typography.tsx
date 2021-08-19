import React from 'react';

/** @internal */
export interface Props {
  children: React.ReactNode;
}

/**
 * @internal
 * TODO implementation coming
 **/
export const Typography = ({ children }: Props) => {
  return <h1>{children}</h1>;
};

Typography.displayName = 'Typography';
