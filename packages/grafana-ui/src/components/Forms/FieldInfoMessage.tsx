import React from 'react';
import { FieldValidationMessageProps } from './FieldValidationMessage';
import { FieldMessage } from './FieldMessage';

export const FieldInfoMessage: React.FC<FieldValidationMessageProps> = (props) => {
  return <FieldMessage role="info" icon="info-circle" {...props} />;
};
