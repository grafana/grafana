import React from 'react';
import { components, InputProps } from 'react-select';

/**
 * Custom input component for react-select to add data-testid attribute
 */
export const CustomInput = (props: InputProps) => {
  return <components.Input {...props} data-testid={props.id ? `data-testid ${props.id}` : ''} />;
};
