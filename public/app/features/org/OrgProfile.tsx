import React, { ChangeEvent, FC } from 'react';
import { Input, Field, Button, Legend } from '@grafana/ui';
import { css } from 'emotion';

export interface Props {
  orgName: string;
  onSubmit: () => void;
  onOrgNameChange: (orgName: string) => void;
}

const OrgProfile: FC<Props> = ({ onSubmit, onOrgNameChange, orgName }) => {
  return (
    <div>
      <Legend>Organization profile</Legend>
      <form
        name="orgForm"
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
        className={css`
          max-width: 400px;
        `}
      >
        <Field label="Organization name">
          <Input
            type="text"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onOrgNameChange(event.target.value)}
            value={orgName}
          />
        </Field>

        <Button type="submit">Submit</Button>
      </form>
    </div>
  );
};

export default OrgProfile;
