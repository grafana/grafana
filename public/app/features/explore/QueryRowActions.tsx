import React from 'react';

export type Props = {
  canToggleEditorModes: boolean;
  hideQuery: boolean;
  onClickToggleEditorMode: () => void;
  onClickToggleHiddenQuery: () => void;
  onClickAddButton: () => void;
  onClickRemoveButton: () => void;
};

export function QueryRowActions(props: Props) {
  const {
    canToggleEditorModes,
    onClickToggleEditorMode,
    onClickToggleHiddenQuery,
    onClickAddButton,
    onClickRemoveButton,
    hideQuery,
  } = props;

  return (
    <div className="gf-form-inline flex-shrink-0">
      {canToggleEditorModes && (
        <div className="gf-form">
          <button className="gf-form-label gf-form-label--btn" onClick={onClickToggleEditorMode}>
            <i className="fa fa-pencil" />
          </button>
        </div>
      )}
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onClickToggleHiddenQuery}>
          <i className={hideQuery ? 'fa fa-eye-slash' : 'fa fa-eye'} />
        </button>
      </div>
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onClickAddButton}>
          <i className="fa fa-plus" />
        </button>
      </div>
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onClickRemoveButton}>
          <i className="fa fa-minus" />
        </button>
      </div>
    </div>
  );
}
