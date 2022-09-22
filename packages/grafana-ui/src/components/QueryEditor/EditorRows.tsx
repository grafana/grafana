import React from 'react';

import { Stack } from './Stack';

interface EditorRowsProps {}

export const EditorRows: React.FC<EditorRowsProps> = ({ children }) => {
  return (
    <Stack gap={0.5} direction="column">
      {children}
    </Stack>
  );
};
