import { components } from '@reactour/tour';
// there is a problem with exported types from react tour
// @ts-ignore
import { BadgeProps } from '@reactour/tour/dist/components/Badge';
import React, { FC } from 'react';

import { useTheme2 } from '@grafana/ui';

const Badge: FC<React.PropsWithChildren<BadgeProps>> = ({ children }) => {
  const theme = useTheme2();

  return (
    <components.Badge
      styles={{
        badge: (base) => ({
          ...base,
          background: theme.colors.primary.main,
          fontFamily: theme.typography.fontFamily,
          fontSize: '0.8em',
        }),
      }}
    >
      {children}
    </components.Badge>
  );
};

export default Badge;
