import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button } from '@grafana/ui';

export interface Props {
  canSave: boolean;
  onSubmit: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTest: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export function ButtonRow({ canSave, onSubmit, onTest }: Props) {
  return (
    <div className="gf-form-button-row">
      {canSave && (
        <Button
          type="submit"
          variant="primary"
          disabled={!canSave}
          onClick={onSubmit}
          aria-label={selectors.pages.DataSource.saveAndTest}
        >
          Save &amp; test
        </Button>
      )}
      {!canSave && (
        <Button variant="primary" onClick={onTest}>
          Test
        </Button>
      )}
    </div>
  );
}
