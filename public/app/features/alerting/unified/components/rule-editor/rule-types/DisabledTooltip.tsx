import * as React from 'react';

import { Tooltip } from '@grafana/ui';
import { t } from 'app/core/internationalization';

type Props = {
  visible: boolean;
};

const DisabledTooltip = ({ children, visible = false }: React.PropsWithChildren<Props>) => {
  if (!visible) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      content={t(
        'alerting.disabled-tooltip.content-appear-compatible-datasources',
        'You do not appear to have any compatible datasources.'
      )}
      placement="top"
    >
      <div>{children}</div>
    </Tooltip>
  );
};

export { DisabledTooltip };
