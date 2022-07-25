import React, { PureComponent } from 'react';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Form, Field, Input, FieldSet } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';

interface TeamDTO {
  name: string;
  email: string;
}

export class CreateTeam extends PureComponent {
  create = async (formModel: TeamDTO) => {
    const result = await getBackendSrv().post('/api/teams', formModel);
    if (result.teamId) {
      await contextSrv.fetchUserPermissions();
      locationService.push(`/org/teams/edit/${result.teamId}`);
    }
  };
  render() {
    return (
      <Page navId="teams">
        <Page.Contents>
          <Form onSubmit={this.create}>
            {({ register, errors }) => (
              <FieldSet label="New Team">
                <Field label="Name" required invalid={!!errors.name} error="Team name is required">
                  <Input {...register('name', { required: true })} id="team-name" width={60} />
                </Field>
                <Field
                  label={'Email'}
                  description={'This is optional and is primarily used for allowing custom team avatars.'}
                >
                  <Input {...register('email')} type="email" id="team-email" placeholder="email@test.com" width={60} />
                </Field>
                <div className="gf-form-button-row">
                  <Button type="submit" variant="primary">
                    Create
                  </Button>
                </div>
              </FieldSet>
            )}
          </Form>
        </Page.Contents>
      </Page>
    );
  }
}

export default CreateTeam;
