import React from 'react';

function formatLatency(value: number) {
  return `${(value / 1000).toFixed(1)}s`;
}

export type Props = {
  canToggleEditorModes: boolean;
  isDisabled?: boolean;
  isNotStarted: boolean;
  latency: number;
  onClickToggleEditorMode: () => void;
  onClickToggleDisabled: () => void;
  onClickRemoveButton: () => void;
};

export function QueryRowActions(props: Props) {
  const {
    canToggleEditorModes,
    onClickToggleEditorMode,
    onClickToggleDisabled,
    onClickRemoveButton,
    isDisabled,
    isNotStarted,
    latency,
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
        <button disabled className="gf-form-label" title="Query row latency">
          {formatLatency(latency)}
        </button>
      </div>
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
        <button className="gf-form-label gf-form-label--btn" onClick={onClickRemoveButton} title="Remove query">
          <i className="fa fa-minus" />
        </button>
      </div>
    </div>
  );
}
