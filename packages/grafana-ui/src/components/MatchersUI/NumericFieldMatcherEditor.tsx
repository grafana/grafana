import React from 'react';
import { FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';

export const NumericFieldMatcherEditor = () => {
  return <></>;
};

export const numericFieldsMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byName,
  component: NumericFieldMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.numeric),
  name: 'Numeric fields',
  description: 'All fields with type number',
  optionsToLabel: options => options,
};
