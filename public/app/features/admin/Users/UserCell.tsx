import React from 'react';

import { CellProps } from '@grafana/ui';
import { UserDTO } from 'app/types';

export const UserCell = ({ cell: { value }, row }: CellProps<UserDTO, string | boolean | number>) => (
  <CellWrapper original={row.original}>{value}</CellWrapper>
);

interface CellWrapperProps {
  original: UserDTO;
  children: React.ReactNode;
}
export const CellWrapper = ({ original, children }: CellWrapperProps) => {
  return (
    <a
      className="ellipsis"
      href={`admin/users/edit/${original.id}`}
      title={original.name}
      aria-label={`Edit user's ${original.name} details`}
    >
      {children}
    </a>
  );
};
