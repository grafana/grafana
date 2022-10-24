import React from 'react';

import { Stack } from './Stack';

interface EditorFieldGroupProps {}

export const EditorFieldGroup = ({ children }: React.PropsWithChildren<EditorFieldGroupProps>) => {
  return <Stack gap={1}>{children}</Stack>;
};
