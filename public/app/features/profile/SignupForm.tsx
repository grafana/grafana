import React, { FC, useState } from 'react';
import { Forms } from '@grafana/ui';

interface Props {
  verifyEmailEnabled: boolean;
  autoAssignOrg: boolean;
  onSubmit(obj: {
    name: string;
    username: string;
    orgName: string;
    email: string;
    code: string;
    password: string;
  }): void;
}

export const Signup: FC<Props> = props => {
  const [email, setEmail] = useState();
  const [code, setCode] = useState();
  // const [username, setUsername] = useState(props.model.username);
  const [orgName, setOrgName] = useState();
  const [name, setName] = useState();
  const [password, setPassword] = useState();
  console.log(props);
  return (
    <div>
      {props.verifyEmailEnabled ? (
        <Forms.Field label="Email code<tip>Email verification code (sent to your email)</tip>">
          <Forms.Input
            size="md"
            value={code || ''}
            placeholder="Org. name"
            onChange={e => setCode(e.currentTarget.value)}
          />
        </Forms.Field>
      ) : (
        ''
      )}
      {!props.autoAssignOrg ? (
        <Forms.Field label="Org. name">
          <Forms.Input
            size="md"
            value={orgName || ''}
            placeholder="Org. name"
            onChange={e => setOrgName(e.currentTarget.value)}
          />
        </Forms.Field>
      ) : (
        ''
      )}
      <Forms.Field label="Your name">
        <Forms.Input
          size="md"
          value={name || ''}
          placeholder="(optional)"
          onChange={e => setName(e.currentTarget.value)}
        />
      </Forms.Field>
      <Forms.Field label="Email">
        <Forms.Input
          size="md"
          value={email || ''}
          placeholder="Email"
          onChange={e => setEmail(e.currentTarget.value)}
        />
      </Forms.Field>
      <Forms.Field label="Password">
        <Forms.Input
          size="md"
          type="password"
          value={password || ''}
          placeholder="Password"
          onChange={e => setPassword(e.currentTarget.value)}
        />
      </Forms.Field>

      <Forms.Button
        onClick={e => {
          props.onSubmit({
            email,
            code,
            orgName,
            password,
            name,
            username,
          });
        }}
      >
        Submit
      </Forms.Button>
      <Forms.Button variant="secondary">Back</Forms.Button>
    </div>
  );
};
