import { PasswordInputField, TextareaInputField } from '@percona/platform-core';
import { Messages } from '../FormParts.messages';
import React, { FC } from 'react';
import { FormPartProps } from '../FormParts.types';

export const MongodbTLSCertificate: FC<FormPartProps> = ({ form }) => {
  const tlsFlag = form.getState().values && form.getState().values['tls'];

  return (
    <>
      {tlsFlag ? (
        <>
          <PasswordInputField
            name="tls_certificate_file_password"
            label={Messages.form.labels.additionalOptions.tlsCertificateFilePassword}
          />
          <TextareaInputField
            name="tls_certificate_key"
            label={Messages.form.labels.additionalOptions.tlsCertificateKey}
          />
          <TextareaInputField name="tls_ca" label={Messages.form.labels.additionalOptions.tlsCA} />
        </>
      ) : null}
    </>
  );
};
