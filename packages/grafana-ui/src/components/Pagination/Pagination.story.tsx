import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Pagination } from './Pagination';
import mdx from './Pagination.mdx';

const meta: Meta<typeof Pagination> = {
  title: 'Buttons/Pagination',
  component: Pagination,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['currentPage', 'onNavigate'],
    },
  },
  argTypes: {
    numberOfPages: {
      control: {
        type: 'number',
        min: 1,
      },
    },
  },
};

export const WithPages: StoryFn<typeof Pagination> = ({ numberOfPages, hideWhenSinglePage }) => {
  const [page, setPage] = useState(1);
  return (
    <Pagination
      numberOfPages={numberOfPages}
      currentPage={page}
      onNavigate={setPage}
      hideWhenSinglePage={hideWhenSinglePage}
    />
  );
};
WithPages.args = {
  numberOfPages: 5,
  hideWhenSinglePage: false,
};

export default meta;
