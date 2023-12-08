import React, { FC } from 'react';

import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from './S3Fields.Messages';
import { MAX_LENGTH } from './S3Fields.constants';
import { S3FieldsProps } from './S3Fields.types';

const required = [validators.required];

export const S3Fields: FC<S3FieldsProps> = ({ endpoint, accessKey, secretKey, bucketName }) => (
  <>
    <TextInputField name="endpoint" label={Messages.endpoint} validators={required} initialValue={endpoint} />
    <TextInputField
      inputProps={{ maxLength: MAX_LENGTH }}
      name="bucketName"
      label={Messages.bucketName}
      validators={required}
      initialValue={bucketName}
    />
    <TextInputField
      inputProps={{ maxLength: MAX_LENGTH }}
      name="accessKey"
      label={Messages.accessKey}
      validators={required}
      initialValue={accessKey}
    />
    <SecretToggler
      fieldProps={{ name: 'secretKey', label: 'Secret Key', validators: required }}
      secret={secretKey}
      maxLength={MAX_LENGTH}
      readOnly={false}
    />
  </>
);
