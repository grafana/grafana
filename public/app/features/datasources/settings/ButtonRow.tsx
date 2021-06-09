import React, { FC } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import config from 'app/core/config';
import { Button, LinkButton } from '@grafana/ui';

export interface Props {
  isReadOnly: boolean;
  onDelete: () => void;
  onSubmit: (event: any) => void;
  onTest: (event: any) => void;
}

const ButtonRow: FC<Props> = ({ isReadOnly, onDelete, onSubmit, onTest }) => {
  return (
    <div className="gf-form-button-row">
      <LinkButton variant="secondary" fill="outline" href={`${config.appSubUrl}/datasources`}>
        Back
      </LinkButton>
      <Button
        type="button"
        variant="destructive"
        disabled={isReadOnly}
        onClick={onDelete}
        aria-label={selectors.pages.DataSource.delete}
      >
        Delete
      </Button>
      {!isReadOnly && (
        <Button
          type="submit"
          variant="primary"
          disabled={isReadOnly}
          onClick={(event) => onSubmit(event)}
          aria-label={selectors.pages.DataSource.saveAndTest}
        >
          Save &amp; test
        </Button>
      )}
      {isReadOnly && (
        <Button type="submit" variant="primary" onClick={onTest}>
          Test
        </Button>
      )}
    </div>
  );
};

export default ButtonRow;
