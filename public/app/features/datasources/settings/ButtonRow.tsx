import React, { FC } from 'react';
import { selectors } from '@grafana/e2e-selectors';

import config from 'app/core/config';

export interface Props {
  isReadOnly: boolean;
  onDelete: () => void;
  onSubmit: (event: any) => void;
  onTest: (event: any) => void;
}

const ButtonRow: FC<Props> = ({ isReadOnly, onDelete, onSubmit, onTest }) => {
  return (
    <div className="gf-form-button-row">
      {!isReadOnly && (
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isReadOnly}
          onClick={event => onSubmit(event)}
          aria-label={selectors.pages.DataSource.saveAndTest}
        >
          Save &amp; Test
        </button>
      )}
      {isReadOnly && (
        <button type="submit" className="btn btn-success" onClick={onTest}>
          Test
        </button>
      )}
      <button
        type="button"
        className="btn btn-danger"
        disabled={isReadOnly}
        onClick={onDelete}
        aria-label={selectors.pages.DataSource.delete}
      >
        Delete
      </button>
      <a className="btn btn-inverse" href={`${config.appSubUrl}/datasources`}>
        Back
      </a>
    </div>
  );
};

export default ButtonRow;
