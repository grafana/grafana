import React from 'react';

import { Button } from '@grafana/ui';

import { Cell } from './Cell';

export function ActionsCell() {
  return (
    <Cell>
      <Button variant="primary">Run</Button>
    </Cell>
  );
}
