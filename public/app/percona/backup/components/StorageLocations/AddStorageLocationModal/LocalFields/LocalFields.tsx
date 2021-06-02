import { TextInputField, validators } from '@percona/platform-core';
import React, { FC } from 'react';

import { Messages } from './LocalFields.messages';
import { LocalFieldsProps } from './LocalFields.types';

const required = [validators.required];

export const LocalFields: FC<LocalFieldsProps> = ({ name, path }) => (
  <TextInputField name={name} validators={required} label={Messages.path} initialValue={path} />
);
