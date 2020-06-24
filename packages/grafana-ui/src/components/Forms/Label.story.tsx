import React from 'react';
import { Label } from './Label';

export default {
  title: 'Forms/Label',
  component: Label,
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
