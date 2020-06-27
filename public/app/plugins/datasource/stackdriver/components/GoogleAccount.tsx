import React, { FunctionComponent, useState } from 'react';
import { debounce } from 'lodash';
import { QueryInlineField } from '.';

export interface Props {
  onChange: (alias: any) => void;
  value: string;
}

export const GoogleAccount: FunctionComponent<Props> = ({ value = '', onChange }) => {
  const [googleAccount, setGoogleAccount] = useState(value);

  const propagateOnChange = debounce(onChange, 1000);

  onChange = (e: any) => {
    setGoogleAccount(e.target.value);
    propagateOnChange(e.target.value);
  };

  return (
    <QueryInlineField
      label="Google Account"
      tooltip="The google account passed to the deep link (useful if the user is signed in to multiple accounts)"
    >
      <input
        type="text"
        placeholder="foo@google.com"
        className="gf-form-input width-26"
        value={googleAccount}
        onChange={onChange}
      />
    </QueryInlineField>
  );
};
