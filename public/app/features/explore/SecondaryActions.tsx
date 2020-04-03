import React from 'react';
import { css, cx } from 'emotion';
import { stylesFactory } from '@grafana/ui';

type Props = {
  addQueryRowButtonDisabled?: boolean;
  richHistoryButtonActive?: boolean;
  addQueryRowButtonHidden?: boolean;
  onClickAddQueryRowButton: () => void;
  onClickRichHistoryButton: () => void;
};

const getStyles = stylesFactory(() => {
  return {
    button: css`
      margin: 1em 4px 0 0;
    `,
  };
});
export function SecondaryActions(props: Props) {
  const styles = getStyles();
  return (
    <div className="gf-form">
      {!props.addQueryRowButtonHidden && (
        <button
          aria-label="Add row button"
          className={`gf-form-label gf-form-label--btn ${styles.button}`}
          onClick={props.onClickAddQueryRowButton}
          disabled={props.addQueryRowButtonDisabled}
        >
          <i className={'fa fa-fw fa-plus icon-margin-right'} />
          <span className="btn-title">{'\xA0' + 'Add query'}</span>
        </button>
      )}
      <button
        aria-label="Rich history button"
        className={cx(`gf-form-label gf-form-label--btn ${styles.button}`, {
          ['explore-active-button']: props.richHistoryButtonActive,
        })}
        onClick={props.onClickRichHistoryButton}
      >
        <i className={'fa fa-fw fa-history icon-margin-right '} />
        <span className="btn-title">{'\xA0' + 'Query history'}</span>
      </button>
    </div>
  );
}
