import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { NewTable } from '@grafana/ui';
import mdx from './NewTable.mdx';

export default {
  title: 'Layout/NewTable',
  component: NewTable,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Single = () => {
  return (
    <NewTable
      headers={[
        {
          name: 'Radios',
          // eslint-disable-next-line react/display-name
          render: (_: any, i: any) => <input type="radio" name="test" value={i} />,
          sortable: false,
        },
        { name: 'Dashboard name' },
        { name: 'Last edited' },
        { name: 'by', render: (s: string) => s.toUpperCase() },
      ]}
      rows={[
        [{}, 'Prometheus Alerts', '2020-11-04', 'LaurenIpsum'],
        [{}, 'Envoy Overview', '2020-11-03', 'jessover9000'],
        [{}, 'Dashboard title', '2020-10-28', 'longestusernameinhistory'],
        [{}, 'A longer dashboard title to test this out', '2020-10-28', 'myfavouriteuser'],
      ]}
    />
  );
};
