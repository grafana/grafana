import React from 'react';

import { useTheme2 } from '@grafana/ui';

const Strong = ({ children }: React.PropsWithChildren) => {
  const theme = useTheme2();
  return <strong style={{ color: theme.colors.text.maxContrast }}>{children}</strong>;
};

export { Strong };
