import React, { useState } from 'react';
import { DatePickerWithEmptyWithInput } from './DatePickerWithEmptyWithInput';
import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';
import mdx from './DatePickerWithEmptyWithInput.mdx';

export default {
  title: 'Pickers and Editors/TimePickers/DatePickerWithEmptyWithInput',
  component: DatePickerWithEmptyWithInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic = () => {
  const [date, setDate] = useState<Date | string>(new Date());
  const [dateInput, setDateInput] = useState<boolean>(true);

  return (
    <DatePickerWithEmptyWithInput
      isDateInput={dateInput}
      value={date}
      onChange={(newDate, dateInput) => {
        setDate(newDate);
        setDateInput(dateInput);
      }}
      returnValue={'start'}
    />
  );
};
