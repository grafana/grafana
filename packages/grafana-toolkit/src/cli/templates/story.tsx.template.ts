export const storyTpl = `
import React from 'react';
import { <%= name %> } from './<%= name %>';
import { withCenteredStory } from '@grafana/ui/src/utils/storybook/withCenteredStory';
import mdx from './<%= name %>.mdx';


export default {
  title: '<%= group %>/<%= name %>',
  component: <%= name %>,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const single = () => {
  return <<%= name %> />;
};
`;
