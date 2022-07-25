import { ComponentMeta } from '@storybook/react';
import React, { useState } from 'react';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { DatePickerWithInput } from './DatePickerWithInput';
import mdx from './DatePickerWithInput.mdx';

const meta: ComponentMeta<typeof DatePickerWithInput> = {
  title: 'Pickers and Editors/TimePickers/DatePickerWithInput',
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

export default meta;
