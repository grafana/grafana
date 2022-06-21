import { MessageDescriptor } from '@lingui/core';
import { Trans as OriginalTrans } from '@lingui/macro';
import React from 'react';

export const Trans: typeof OriginalTrans = ({ id, children }) => {
  return <>{children ?? id}</>;
};

export const Plural: React.FC = () => {
  throw new Error('Plural mock not implemented yet');
};

export const Select: React.FC = () => {
  throw new Error('Select mock not implemented yet');
};

export const SelectOrdinal: React.FC = () => {
  throw new Error('SelectOrdinal mock not implemented yet');
};

export const t = (msg: string | { message: string }) => {
  return typeof msg === 'string' ? msg : msg.message;
};

export const defineMessage = (descriptor: MessageDescriptor) => {
  // We return the message as the ID so we can assert on the plain english value
  return { ...descriptor, id: descriptor.message };
};
