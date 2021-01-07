import React from 'react';
import { FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';

export const FirstFieldMatcherEditor = () => {
  return <></>;
};

export const firstFieldsMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.first,
  component: FirstFieldMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.first),
  name: 'First field',
  description: 'The first field in the result',
  optionsToLabel: options => options,
};
