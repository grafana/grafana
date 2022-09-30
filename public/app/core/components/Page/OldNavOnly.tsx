import React from 'react';

interface Props {
  children: React.ReactNode;
}

/** Remove after topnav feature toggle is removed */
export function OldNavOnly({ children }: Props): React.ReactElement | null {
  return <>{children}</>;
}
