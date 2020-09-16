import React from 'react';
import { InlineFormLabel } from './FormLabel';
//import mdx from './FormLabel';

export default {
  title: 'Forms/InlineFormLabel',
  component: InlineFormLabel,
  // parameters: {
  //   docs: {
  //     page: mdx,
  //   },
  // },
};

export const basic = () => {
  return <InlineFormLabel width="auto">Simple label</InlineFormLabel>;
};

export const withTooltip = () => {
  return (
    <div className="gf-form">
      <InlineFormLabel width="auto" tooltip="Some tooltip content">
        Simple label
      </InlineFormLabel>
    </div>
  );
};
