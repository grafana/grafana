import { StoryFn, Meta } from '@storybook/react';

import { SeriesTable } from './SeriesTable';

const meta: Meta<typeof SeriesTable> = {
  title: 'Plugins/SeriesTable',
  component: SeriesTable,
  argTypes: {
    timestamp: {
      control: 'date',
    },
  },
};

const Template: StoryFn<typeof SeriesTable> = (args) => {
  const date = new Date(args.timestamp!).toLocaleString();
  return (
    <div>
      <SeriesTable {...args} timestamp={date} />
    </div>
  );
};

export const basic = Template.bind({});

basic.args = {
  timestamp: new Date('2021-01-01T00:00:00').toISOString(),
  series: [
    {
      color: '#299c46',
      label: 'label 1',
      value: '100 W',
    },
  ],
};

export const multi = Template.bind({});

multi.args = {
  timestamp: new Date('2021-01-01T00:00:00').toISOString(),
  series: [
    {
      color: '#299c46',
      label: 'label 1',
      value: '100 W',
      isActive: false,
    },
    {
      color: '#9933cc',
      label: 'label yes',
      value: '25 W',
      isActive: true,
    },
    {
      color: '#eb7b18',
      label: 'label 3',
      value: '150 W',
      isActive: false,
    },
  ],
};

export default meta;
