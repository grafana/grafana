import React from 'react';

import { Stack } from './Stack';

interface EditorRowsProps {
  children: React.ReactNode;
}

export const EditorRows = ({ children }: EditorRowsProps) => {
  return (
    <Stack gap={0.5} direction="column">
      {children}
    </Stack>
  );
};
