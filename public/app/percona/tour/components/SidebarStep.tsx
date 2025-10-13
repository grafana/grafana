import { FC, PropsWithChildren } from 'react';

interface Props extends PropsWithChildren {
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
