import React from 'react';

export type Props = {
  canToggleEditorModes: boolean;
  isDisabled: boolean;
  isNotStarted: boolean;
  onClickToggleEditorMode: () => void;
  onClickToggleDisabled: () => void;
  onClickAddButton: () => void;
  onClickRemoveButton: () => void;
};

export function QueryRowActions(props: Props) {
  const {
    canToggleEditorModes,
    onClickToggleEditorMode,
    onClickToggleDisabled,
    onClickAddButton,
    onClickRemoveButton,
    isDisabled,
    isNotStarted,
  } = props;

  return (
    <div className="gf-form-inline flex-shrink-0">
      {canToggleEditorModes && (
        <div className="gf-form">
          <button
            aria-label="Edit mode button"
            className="gf-form-label gf-form-label--btn"
            onClick={onClickToggleEditorMode}
          >
            <i className="fa fa-pencil" />
          </button>
        </div>
      )}
      <div className="gf-form">
        <button
          disabled={isNotStarted}
          className="gf-form-label gf-form-label--btn"
          onClick={onClickToggleDisabled}
          title="Disable/enable query"
        >
          <i className={isDisabled ? 'fa fa-eye-slash' : 'fa fa-eye'} />
        </button>
      </div>
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onClickAddButton} title="Add query">
          <i className="fa fa-plus" />
        </button>
      </div>
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onClickRemoveButton} title="Remove query">
          <i className="fa fa-minus" />
        </button>
      </div>
    </div>
  );
}
