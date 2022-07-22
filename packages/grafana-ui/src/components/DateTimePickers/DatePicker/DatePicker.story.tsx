import { ComponentMeta } from '@storybook/react';
import React, { useState } from 'react';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import { Button } from '../../Button/Button';

import { DatePicker } from './DatePicker';
import mdx from './DatePicker.mdx';

const meta: ComponentMeta<typeof DatePicker> = {
  title: 'Pickers and Editors/TimePickers/Pickers And Editors/DatePicker',
  component: DatePicker,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Show Calendar</Button>
      <DatePicker isOpen={open} value={date} onChange={(newDate) => setDate(newDate)} onClose={() => setOpen(false)} />
    </>
  );
};

export default meta;
