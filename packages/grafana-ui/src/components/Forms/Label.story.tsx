import React from 'react';
import { Label } from './Label';
import mdx from './Label.mdx';

export default {
  title: 'Forms/Label',
  component: Label,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  return <Label description="Option description">Option name</Label>;
};

export const categorised = () => {
  return (
    <Label category={['Category', 'Nested category']} description="Option description">
      Option name
    </Label>
  );
};
