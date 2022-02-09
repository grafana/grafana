import React, { useState } from 'react';
import { DatePicker } from './DatePicker';
import { Button } from '../../Button/Button';
import mdx from './DatePicker.mdx';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

export default {
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
