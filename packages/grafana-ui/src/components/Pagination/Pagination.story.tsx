import React, { useState } from 'react';
import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Pagination } from '@grafana/ui';
import mdx from './Pagination.mdx';
import { Props } from './Pagination';

export default {
  title: 'Buttons/Pagination',
  component: Pagination,
  decorators: [withCenteredStory],
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

export const WithPages: Story<Props> = ({ numberOfPages, hideWhenSinglePage }) => {
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
