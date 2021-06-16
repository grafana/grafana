import React, { useState } from 'react';
import { DatePickerWithInput } from './DatePickerWithInput';

export default {
  title: 'Pickers And Editors/DatePickerWithInput',
  component: DatePickerWithInput,
};

export const Basic = () => {
  const [date, setDate] = useState<Date>(new Date());

  return <DatePickerWithInput width={40} value={date} onChange={(newDate) => setDate(newDate as Date)} />;
};
