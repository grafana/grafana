import React, { FC } from 'react';

import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { Messages } from './LocalFields.messages';
import { LocalFieldsProps } from './LocalFields.types';

const required = [validators.required];

export const LocalFields: FC<React.PropsWithChildren<LocalFieldsProps>> = ({ name, path }) => (
  <TextInputField name={name} validators={required} label={Messages.path} initialValue={path} />
);
