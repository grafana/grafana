export const storyTpl = `import React from 'react';
import <%= name %> from './<%= name %>';
import mdx from './<%= name %>.mdx';


export default {
  title: 'General/<%= name %>',
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
