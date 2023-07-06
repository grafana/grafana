import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button } from '@grafana/ui';

export interface Props {
  canSave: boolean;
  canDelete: boolean;
  onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSubmit: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTest: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export function ButtonRow({ canSave, canDelete, onDelete, onSubmit, onTest }: Props) {
  return (
    <div className="gf-form-button-row">
      <Button
        type="button"
        variant="destructive"
        disabled={!canDelete}
        onClick={onDelete}
        data-testid={selectors.pages.DataSource.delete}
      >
        Delete
      </Button>
      {canSave && (
        <Button
          type="submit"
          variant="primary"
          disabled={!canSave}
          onClick={onSubmit}
          data-testid={selectors.pages.DataSource.saveAndTest}
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
