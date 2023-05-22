export const componentTpl = `import React from 'react';

export interface Props {};

export const <%= name %> = (props: Props) => {
  return (
    <div>Hello world!</div>
  )
};
`;
