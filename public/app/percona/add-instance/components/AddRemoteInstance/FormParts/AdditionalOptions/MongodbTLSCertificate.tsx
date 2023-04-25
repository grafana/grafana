import React, { FC } from 'react';

import { PasswordInputField } from 'app/percona/shared/components/Form/PasswordInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';

import { Messages } from '../FormParts.messages';
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
            tooltipIcon="info-circle"
            label={Messages.form.labels.additionalOptions.tlsCertificateKey}
            tooltipText={Messages.form.labels.tooltips.tlsCertificateKey}
          />
          <TextareaInputField
            name="tls_ca"
            label={Messages.form.labels.additionalOptions.tlsCA}
            tooltipIcon="info-circle"
            tooltipText={Messages.form.labels.tooltips.tlsCA}
          />
        </>
      ) : null}
    </>
  );
};
