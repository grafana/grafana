import React from 'react';
import { CellProps } from 'react-table';

import { Button } from '@grafana/ui';

import { QueryTemplateRow } from '../utils/view';

export function ActionsCell() {
  return (
    <span>
      <Button variant="primary">Run</Button>
    </span>
  );
}
