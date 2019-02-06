import React, { FC } from 'react';

export interface Props {
  isReadOnly: boolean;
  onDelete: () => void;
  onSubmit: (event) => void;
}

const ButtonRow: FC<Props> = ({ isReadOnly, onDelete, onSubmit }) => {
  return (
    <div className="gf-form-button-row">
      <button type="submit" className="btn btn-success" disabled={isReadOnly} onClick={event => onSubmit(event)}>
        Save &amp; Test
      </button>
      <button type="submit" className="btn btn-danger" disabled={isReadOnly} onClick={onDelete}>
        Delete
      </button>
      <a className="btn btn-inverse" href="/datasources">
        Back
      </a>
    </div>
  );
};

export default ButtonRow;
