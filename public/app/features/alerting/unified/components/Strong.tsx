import React, { ReactNode } from 'react';

import { Text } from '@grafana/ui';

interface Props {
  children: NonNullable<ReactNode>;
}

const Strong = ({ children }: Props) => {
  return <Text weight="bold">{children}</Text>;
};

export { Strong };
