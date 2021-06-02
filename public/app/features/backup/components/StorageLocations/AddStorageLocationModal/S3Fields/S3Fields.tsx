import React, { FC } from 'react';
import { TextInputField, validators } from '@percona/platform-core';
import { S3FieldsProps } from './S3Fields.types';
import { Messages } from './S3Fields.Messages';
import { SecretToggler } from '../../../SecretToggler';

const required = [validators.required];

export const S3Fields: FC<S3FieldsProps> = ({ endpoint, accessKey, secretKey, bucketName }) => (
  <>
    <TextInputField name="endpoint" label={Messages.endpoint} validators={required} initialValue={endpoint} />
    <TextInputField name="bucketName" label={Messages.bucketName} validators={required} initialValue={bucketName} />
    <TextInputField name="accessKey" label={Messages.accessKey} validators={required} initialValue={accessKey} />
    <SecretToggler
      fieldProps={{ name: 'secretKey', label: 'Secret Key', validators: required }}
      secret={secretKey}
      readOnly={false}
    />
  </>
);
