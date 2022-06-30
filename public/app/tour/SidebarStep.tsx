import React, { FC } from 'react';

interface Props {
  title: string;
}

const SidebarStep: FC<Props> = ({ title, children }) => (
  <>
    <h4>
      <strong>{title}</strong>
    </h4>
    {children}
  </>
);

export default SidebarStep;
