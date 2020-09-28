import React from 'react';
import { InlineLabel } from './InlineLabel';
import mdx from './InlineLabel.mdx';

export default {
  title: 'Forms/InlineLabel',
  component: InlineLabel,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return <InlineLabel width="auto">Simple label</InlineLabel>;
};

export const withTooltip = () => {
  return (
    <InlineLabel width="auto" tooltip="Tooltip content">
      Simple label
    </InlineLabel>
  );
};
