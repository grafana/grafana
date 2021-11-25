import React from 'react';
import Stack from './Stack';

interface EditorRowsProps {}

const EditorRows: React.FC<EditorRowsProps> = ({ children }) => {
  return (
    <Stack gap={0.5} direction="column">
      {children}
    </Stack>
  );
};

export default EditorRows;
