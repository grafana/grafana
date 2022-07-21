import React from 'react';

import { Stack } from './Stack';

interface EditorFieldGroupProps {}

export const EditorFieldGroup: React.FC<EditorFieldGroupProps> = ({ children }) => {
  return <Stack gap={1}>{children}</Stack>;
};
