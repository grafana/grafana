import React, { FunctionComponent, useState } from 'react';
import _ from 'lodash';
import { css, cx } from 'emotion';
import { SegmentInput } from '@grafana/ui';

export interface Props {
  value: string;
  onChange: (slo: string) => void;
}

const closeButtonStyle = css`
  border: 0;
  background: transparent;
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 12px;
`;

export const SLOFilter: FunctionComponent<Props> = ({ onChange, value = '' }) => {
  const [showSlo, setShowSlo] = useState(!!value);
  const [autofocus, setAutofocus] = useState(false);

  return (
    <>
      {showSlo && (
        <SegmentInput
          Component={
            <a className="gf-form-label query-part">
              <button
                title="Remove filter"
                onClick={e => {
                  e.stopPropagation();
                  onChange('');
                  setShowSlo(false);
                }}
                className={cx(closeButtonStyle)}
              >
                <i className={cx('fa fa-close')}></i>
              </button>
              {value}
            </a>
          }
          value={value}
          autofocus={autofocus}
          placeholder="Enter custom filter"
          onChange={value => {
            setShowSlo(!!value);
            onChange(value as string);
          }}
        />
      )}

      {!showSlo && (
        <a
          onClick={() => {
            setShowSlo(true);
            setAutofocus(true);
          }}
          className="gf-form-label query-part"
        >
          <i className="fa fa-plus" />
        </a>
      )}
    </>
  );
};
