import React from 'react';

import { Icon, Tooltip } from '@grafana/ui';

export function InfoIcon({ text }: { text: string }) {
  return (
    <Tooltip placement="top" content={<div>{text}</div>}>
      <Icon name="info-circle" size="xs" />
    </Tooltip>
  );
}
