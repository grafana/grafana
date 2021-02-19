import React, { ChangeEvent, MouseEvent, FC } from 'react';

interface Props {
  label: string;
  hasCert: boolean;
  placeholder: string;

  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export const CertificationKey: FC<Props> = ({ hasCert, label, onChange, onClick, placeholder }) => {
  return (
    <div className="gf-form-inline">
      <div className="gf-form gf-form--v-stretch">
        <label className="gf-form-label width-7">{label}</label>
      </div>
      {!hasCert && (
        <div className="gf-form gf-form--grow">
          <textarea
            rows={7}
            className="gf-form-input gf-form-textarea"
            onChange={onChange}
            placeholder={placeholder}
            required
          />
        </div>
      )}

      {hasCert && (
        <div className="gf-form">
          <input type="text" className="gf-form-input max-width-12" disabled value="configured" />
          <a className="btn btn-secondary gf-form-btn" onClick={onClick}>
            reset
          </a>
        </div>
      )}
    </div>
  );
};
