import React from 'react';
import { Unicon } from '@grafana/ui/src/components/Icon/Unicon';

export type Props = {
  canToggleEditorModes: boolean;
  isDisabled?: boolean;
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
            <Unicon name="pen" />
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
          <Unicon name={isDisabled ? 'eye-slash' : 'eye'} />
        </button>
      </div>
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onClickAddButton} title="Add query">
          <Unicon name="plus" />
        </button>
      </div>
      <div className="gf-form">
        <button className="gf-form-label gf-form-label--btn" onClick={onClickRemoveButton} title="Remove query">
          <Unicon name="minus" />
        </button>
      </div>
    </div>
  );
}
