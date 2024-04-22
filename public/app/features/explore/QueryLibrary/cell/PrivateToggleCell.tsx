import React from 'react';

import { Switch } from '@grafana/ui/src/components/Switch/Switch';

import { Cell } from './Cell';

export function PrivateToggleCell() {
  return (
    <Cell>
      <Switch />
    </Cell>
  );
}
