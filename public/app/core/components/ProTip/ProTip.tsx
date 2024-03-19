import React from 'react';

import { Icon, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

interface Props {}

export const ProTip = ({ children }: React.PropsWithChildren<Props>) => {
  const Content = () => <>{children}</>;

  return (
    <Stack direction="row" alignItems="center">
      <Icon name="rocket" />
      <span>
        <Trans i18nKey="pro-tip.title">
          ProTip: <Content />
        </Trans>
      </span>
    </Stack>
  );
};
