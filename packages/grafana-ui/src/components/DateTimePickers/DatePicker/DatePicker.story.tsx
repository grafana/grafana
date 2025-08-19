import { Meta } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../../Button/Button';

import { DatePicker, DatePickerProps } from './DatePicker';
import mdx from './DatePicker.mdx';

const meta: Meta<typeof DatePicker> = {
  title: 'Date time pickers/DatePicker',
  component: DatePicker,
  argTypes: {
    minDate: { control: 'date' },
  },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange', 'onClose', 'value', 'isOpen'],
    },
  },
};

export const Basic = (args: DatePickerProps) => {
  const [date, setDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);

  if (args?.minDate !== undefined) {
    args.minDate = new Date(args.minDate);
  }

  args = {
    ...args,
    isOpen: open,
    value: date,
    onChange: (newDate) => setDate(newDate),
    onClose: () => setOpen(false),
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Show Calendar</Button>
      <DatePicker {...args} />
    </>
  );
};

export default meta;
