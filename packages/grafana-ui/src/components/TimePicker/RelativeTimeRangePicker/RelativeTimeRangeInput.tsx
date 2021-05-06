import React, { FC } from 'react';
import { Input } from '../../Input/Input';
import { Field } from '../../Forms/Field';

interface InputState {
  value: string;
  invalid: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export const RelativeTimeRangeInput: FC = ({ value, onChange }) => {
  const [from, setFrom] = useState<InputState>(valueToState(value.raw.from, false, timeZone));

  return (
    <Field label="From" invalid={from.invalid} error={errorMessage}>
      <Input
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setFrom(eventToState(event, false, timeZone))}
        aria-label="TimePicker from field"
        value={value}
      />
    </Field>
  );
};
