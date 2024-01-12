import { Meta } from '@storybook/react';
import React from 'react';

import { EmptySearchResult } from './EmptySearchResult';
import mdx from './EmptySearchResult.mdx';

const meta: Meta<typeof EmptySearchResult> = {
  title: 'Visualizations/EmptySearchResult',
  component: EmptySearchResult,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic = () => {
  return <EmptySearchResult>Could not find anything matching your query</EmptySearchResult>;
};

export default meta;
