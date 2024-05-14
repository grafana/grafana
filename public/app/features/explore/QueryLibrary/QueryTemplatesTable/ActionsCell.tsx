import React from 'react';

import { Button } from '@grafana/ui';

export function ActionsCell() {
  return (
    <>
      <Button disabled={true} variant="primary">
        Run
      </Button>
    </>
  );
}
