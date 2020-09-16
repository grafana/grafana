import React from 'react';
import { InlineFormLabel } from './InlineFormLabel';
//import mdx from './InlineFormLabel';

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
    <InlineFormLabel width="auto" tooltip="Tooltip content">
      Simple label
    </InlineFormLabel>
  );
};
