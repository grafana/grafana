import React, { FC } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Input, Field, Form, Button, FieldSet, VerticalGroup } from '@grafana/ui';

import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { updateTeam } from './state/actions';
import { AccessControlAction, Team } from 'app/types';
import { contextSrv } from 'app/core/core';

const mapDispatchToProps = {
  updateTeam,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {
  team: Team;
}
export type Props = ConnectedProps<typeof connector> & OwnProps;

export const TeamSettings: FC<Props> = ({ team, updateTeam }) => {
  const canWriteTeamSettings = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsWrite, team);

  return (
    <VerticalGroup>
      <FieldSet label="Team settings">
        <Form
          defaultValues={{ ...team }}
          onSubmit={(formTeam: Team) => {
            updateTeam(formTeam.name, formTeam.email);
          }}
          disabled={!canWriteTeamSettings}
        >
          {({ register }) => (
            <>
              <Field label="Name" disabled={!canWriteTeamSettings}>
                <Input {...register('name', { required: true })} id="name-input" />
              </Field>

              <Field
                label="Email"
                description="This is optional and is primarily used to set the team profile avatar (via gravatar service)."
                disabled={!canWriteTeamSettings}
              >
                <Input {...register('email')} placeholder="team@email.com" type="email" id="email-input" />
              </Field>
              <Button type="submit" disabled={!canWriteTeamSettings}>
                Update
              </Button>
            </>
          )}
        </Form>
      </FieldSet>
      <SharedPreferences resourceUri={`teams/${team.id}`} disabled={!canWriteTeamSettings} />
    </VerticalGroup>
  );
};

export default connector(TeamSettings);
