import { TextareaInputField } from '@percona/platform-core';
import { Messages } from '../FormParts.messages';
import React, { FC } from 'react';
import { FormPartProps } from '../FormParts.types';

export const MysqlTLSCertificate: FC<FormPartProps> = ({ form }) => {
  const tlsFlag = form.getState().values && form.getState().values['tls'];

  return (
    <>
      {tlsFlag ? (
        <>
          <TextareaInputField name="tls_ca" label={Messages.form.labels.additionalOptions.tlsCA} />
          <TextareaInputField name="tls_key" label={Messages.form.labels.additionalOptions.tlsCertificateKey} />
          <TextareaInputField name="tls_cert" label={Messages.form.labels.additionalOptions.tlsCertificate} />
        </>
      ) : null}
    </>
  );
};
