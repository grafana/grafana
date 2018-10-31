import React, { SFC } from 'react';

export interface Props {
  isReadOnly: boolean;
  onDelete: (event) => void;
  onSubmit: (event) => void;
}

const ButtonRow: SFC<Props> = ({ isReadOnly, onDelete, onSubmit }) => {
  return (
    <div className="gf-form-button-row">
      <button type="submit" className="btn btn-success" disabled={isReadOnly} onClick={event => onSubmit(event)}>
        Save &amp; Test
      </button>
      <button type="submit" className="btn btn-danger" disabled={isReadOnly} onClick={event => onDelete(event)}>
        Delete
      </button>
      <a className="btn btn-inverse" href="/datasources">
        Back
      </a>
    </div>
  );
};

export default ButtonRow;
