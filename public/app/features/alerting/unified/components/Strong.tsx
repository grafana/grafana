import React, { FC } from 'react';

import { useTheme2 } from '@grafana/ui';

const Strong: FC = ({ children }) => {
  const theme = useTheme2();
  return <strong style={{ color: theme.colors.text.maxContrast }}>{children}</strong>;
};

export { Strong };
