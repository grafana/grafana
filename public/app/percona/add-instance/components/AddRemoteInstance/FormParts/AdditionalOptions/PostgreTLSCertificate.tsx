import React, { FC } from 'react';

import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';

import { Messages } from '../FormParts.messages';
import { FormPartProps } from '../FormParts.types';

export const PostgreTLSCertificate: FC<React.PropsWithChildren<FormPartProps>> = ({ form }) => {
  const values = form.getState().values;
  const tlsFlag = values && values['tls'];

  return (
    <>
      {tlsFlag ? (
        <>
          <TextareaInputField
            name="tls_ca"
            label={Messages.form.labels.additionalOptions.tlsCA}
            tooltipIcon="info-circle"
            tooltipText={Messages.form.labels.tooltips.tlsCA}
          />
          <TextareaInputField
            name="tls_key"
            label={Messages.form.labels.additionalOptions.tlsCertificateKey}
            tooltipIcon="info-circle"
            tooltipText={Messages.form.labels.tooltips.tlsCertificateKey}
          />
          <TextareaInputField
            name="tls_cert"
            label={Messages.form.labels.additionalOptions.tlsCertificate}
            tooltipIcon="info-circle"
            tooltipText={Messages.form.labels.tooltips.tlsCertificate}
          />
        </>
      ) : null}
    </>
  );
};
