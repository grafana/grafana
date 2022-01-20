import React from 'react';

export const Trans: React.FC = ({ children }) => {
  return <>{children}</>;
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
