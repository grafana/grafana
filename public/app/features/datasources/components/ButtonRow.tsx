import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
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
        <Trans i18nKey="datasources.button-row.delete">Delete</Trans>
      </Button>
      {canSave && (
        <Button
          type="submit"
          variant="primary"
          disabled={!canSave}
          onClick={onSubmit}
          data-testid={selectors.pages.DataSource.saveAndTest}
          id={selectors.pages.DataSource.saveAndTest}
        >
          <Trans i18nKey="datasources.button-row.save-and-test">Save &amp; test</Trans>
        </Button>
      )}
      {!canSave && (
        <Button variant="primary" onClick={onTest}>
          <Trans i18nKey="datasources.button-row.test">Test</Trans>
        </Button>
      )}
    </div>
  );
}
