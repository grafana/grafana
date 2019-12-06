import React, { useState } from 'react';
import { Legend } from './Legend';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { withStoryContainer } from '../../utils/storybook/withStoryContainer';
import { Field } from './Field';
import { Input } from './Input/Input';
import { Button } from './Button';
import { Form } from './Form';
import { Switch } from './Switch';
import { Icon } from '../Icon/Icon';
import { Checkbox } from './Checkbox';
import { TextArea } from './TextArea/TextArea';
import { FormSchemaBuilder } from './JSFormWrappers/FormSchemaBuilder';

export default {
  title: 'UI/Forms/Test forms',
  decorators: [withStoryContainer, withCenteredStory],
};

export const users = () => {
  const [name, setName] = useState();
  const [email, setEmail] = useState();
  const [username, setUsername] = useState();
  const [password, setPassword] = useState();
  const [disabledUser, setDisabledUser] = useState(false);
  const [checked, setChecked] = useState(false);

  return (
    <>
      {/* <Form> */}
      <Legend>Edit user</Legend>
      <Field label="Name">
        <Input
          id="name"
          placeholder="Roger Waters"
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          size="md"
        />
      </Field>
      <Field label="Email">
        <Input
          id="email"
          type="email"
          placeholder="roger.waters@grafana.com"
          value={email}
          onChange={e => setEmail(e.currentTarget.value)}
          size="md"
        />
      </Field>
      <Field label="Username">
        <Input
          id="username"
          placeholder="mr.waters"
          value={username}
          onChange={e => setUsername(e.currentTarget.value)}
          size="md"
        />
      </Field>
      <Field label="Disable" description="Added for testing purposes">
        <Switch checked={disabledUser} onChange={(_e, checked) => setDisabledUser(checked)} />
      </Field>
      <Field>
        <Checkbox
          label="Skip SLL cert validation"
          description="Set to true if you want to skip sll cert validation"
          value={checked}
          onChange={setChecked}
        />
      </Field>
      <Button>Update</Button>
      {/* </Form> */}
      {/* <Form> */}
      <Legend>Change password</Legend>
      <Field label="Password">
        <Input
          id="password>"
          type="password"
          placeholder="Be safe..."
          value={password}
          onChange={e => setPassword(e.currentTarget.value)}
          size="md"
          prefix={<Icon name="lock" />}
        />
      </Field>
      <Button>Update</Button>
      {/* </Form> */}

      {/* <Form> */}
      <fieldset>
        <Legend>CERT validation</Legend>
        <Field
          label="Path to client cert"
          description="Authentication against LDAP servers requiring client certificates if not required leave empty "
        >
          <TextArea id="clientCert" value={''} size="lg" />
        </Field>
      </fieldset>
      <Button>Update</Button>
      {/* </Form> */}
    </>
  );
};

export const jsonSchemaForms = () => {
  const formSchema = new FormSchemaBuilder('Sample form')
    .addTextInput('username', {
      label: 'Username',
      description: 'Provide the username you create',
      placeholder: 'Your username',
      required: true,
      minLength: 5,
    })
    .addTextInput('email', {
      label: 'E-mail',
      placeholder: 'roger@waters.io',
      required: true,
      minLength: 5,
      format: 'email',
    })
    .addTextInput('hex', {
      label: 'HEX color',
      description: 'This uses regex for validating HEX',
      placeholder: '#cccccc',
      pattern: /^#?([a-f0-9]{6}|[a-f0-9]{3})$/,
      required: true,
    })
    .addNumberInput('age', {
      label: 'Your age',
      description: 'Are you young enough?',
      placeholder: '11',
    })
    .addSwitch('over', true, {
      label: 'Are you sure you are young enough...?',
      description: 'Just checking...',
      required: true,
    })
    .addSelect(
      'datasource',
      [
        {
          label: 'Prometheus',
          value: 'prometheus',
        },
        {
          label: 'Graphite',
          value: 'graphite',
        },
        {
          label: 'InfluxDB',
          value: 'influx',
        },
      ],
      {
        label: 'Select datasource',
      }
    );

  return (
    <>
      <Form
        {...formSchema.getFormProps()}
        onSubmit={data => {
          console.log(data);
        }}
        onChange={data => {
          console.log(data);
        }}
      >
        <div>
          <Button type="submit">Just send it...</Button>
        </div>
      </Form>
    </>
  );
};
