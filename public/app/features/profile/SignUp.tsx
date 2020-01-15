import React, { FC, useState } from 'react';
import { Forms } from '@grafana/ui';

interface Props {
  verifyEmailEnabled: boolean;
  autoAssignOrg: boolean;
  model: {
    email: string;
    password: string;
    code: string;
    orgName: string;
    username: string;
    name: string;
    verifyEmailEnabled: boolean;
  };
}

export const SignUp: FC<Props> = props => {
  const [email, setEmail] = useState(props.model.email);
  const [code, setCode] = useState(props.model.code);
  const [username, setUsername] = useState(props.model.username);
  const [orgName, setOrgName] = useState(props.model.orgName);
  const [name, setName] = useState(props.model.name);
  const [password, setPassword] = useState(props.model.password);
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

      <Forms.Button disabled>Submit</Forms.Button>
      <Forms.Button variant="secondary">Back</Forms.Button>
    </div>
  );
};
