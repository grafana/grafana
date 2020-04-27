import React, { useState } from 'react';
import { number } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Pagination } from './Pagination';
import mdx from './Pagination.mdx';

export const WithPages = () => {
  const [page, setPage] = useState(1);
  const numberOfPages = number('Number of pages', 5);
  return <Pagination numberOfPages={numberOfPages} currentPage={page} onNavigate={setPage} />;
};

export default {
  title: 'Buttons/Pagination',
  component: WithPages,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};
