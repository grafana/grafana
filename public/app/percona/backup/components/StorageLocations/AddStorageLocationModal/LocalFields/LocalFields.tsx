import React, { FC } from 'react';
import { TextInputField, validators } from '@percona/platform-core';
import { LocalFieldsProps } from './LocalFields.types';
import { Messages } from './LocalFields.messages';

const required = [validators.required];

export const LocalFields: FC<LocalFieldsProps> = ({ name, path }) => (
  <TextInputField name={name} validators={required} label={Messages.path} initialValue={path} />
);
