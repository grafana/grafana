import React, { useState } from 'react';
import { DatePickerWithEmpty } from './DatePickerWithEmpty';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import mdx from './DatePickerWithInput.mdx';

export default {
  title: 'Pickers and Editors/TimePickers/DatePickerWithEmpty',
  component: DatePickerWithEmpty,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <DatePickerWithEmpty
      onClose={() => {}}
      isDateInput={true}
      isOpen={true}
      value={date}
      onChange={(newDate) => setDate(newDate)}
    />
  );
};
