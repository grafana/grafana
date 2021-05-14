import React, { FC } from 'react';
import { connect } from 'react-redux';
import { Input, Field, Form, Button, FieldSet, VerticalGroup } from '@grafana/ui';

import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { updateTeam } from './state/actions';
import { Team } from 'app/types';

export interface Props {
  team: Team;
  updateTeam: typeof updateTeam;
}

export const TeamSettings: FC<Props> = ({ team, updateTeam }) => {
  return (
    <VerticalGroup>
      <FieldSet label="Team settings">
        <Form
          defaultValues={{ ...team }}
          onSubmit={(formTeam: Team) => {
            updateTeam(formTeam.name, formTeam.email);
          }}
        >
          {({ register }) => (
            <>
              <Field label="Name">
                <Input {...register('name', { required: true })} />
              </Field>

              <Field
                label="Email"
                description="This is optional and is primarily used to set the team profile avatar (via gravatar service)."
              >
                <Input {...register('email')} placeholder="team@email.com" type="email" />
              </Field>
              <Button type="submit">Update</Button>
            </>
          )}
        </Form>
      </FieldSet>
      <SharedPreferences resourceUri={`teams/${team.id}`} />
    </VerticalGroup>
  );
};

const mapDispatchToProps = {
  updateTeam,
};

export default connect(null, mapDispatchToProps)(TeamSettings);
