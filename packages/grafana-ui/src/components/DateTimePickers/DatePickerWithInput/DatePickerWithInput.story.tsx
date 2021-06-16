import React, { useState } from 'react';
import { DatePickerWithInput } from './DatePickerWithInput';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import mdx from './DatePickerWithInput.mdx';

export default {
  title: 'Pickers And Editors/DatePickerWithInput',
  component: DatePickerWithInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic = () => {
  const [date, setDate] = useState<Date | string>(new Date());

  return <DatePickerWithInput width={40} value={date} onChange={(newDate) => setDate(newDate)} />;
};
