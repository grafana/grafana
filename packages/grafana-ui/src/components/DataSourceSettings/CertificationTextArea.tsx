import React, { FC, HTMLProps } from 'react';

interface Props extends HTMLProps<HTMLTextAreaElement> {}

export const CertificationTextArea: FC<Props> = ({ onChange, placeholder, value }) => {
  return (
    <div className="gf-form gf-form--grow">
      <textarea
        rows={7}
        className="gf-form-input gf-form-textarea"
        onChange={onChange}
        placeholder={placeholder}
        value={value}
        required
      />
    </div>
  );
};
