import React from 'react';

import { Stack } from './Stack';

interface EditorRowsProps {}

export const EditorRows = ({ children }: React.PropsWithChildren<EditorRowsProps>) => {
  return (
    <Stack gap={0.5} direction="column">
      {children}
    </Stack>
  );
};
