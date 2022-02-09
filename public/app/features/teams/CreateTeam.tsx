import React, { PureComponent } from 'react';
import Page from 'app/core/components/Page/Page';
import { Button, Form, Field, Input, FieldSet, Label, Tooltip, Icon } from '@grafana/ui';
import { NavModel } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { connect } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

export interface Props {
  navModel: NavModel;
}

interface TeamDTO {
  name: string;
  email: string;
}

export class CreateTeam extends PureComponent<Props> {
  create = async (formModel: TeamDTO) => {
    const result = await getBackendSrv().post('/api/teams', formModel);
    if (result.teamId) {
      locationService.push(`/org/teams/edit/${result.teamId}`);
    }
  };
  render() {
    const { navModel } = this.props;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <Form onSubmit={this.create}>
            {({ register }) => (
              <FieldSet label="New Team">
                <Field label="Name">
                  <Input {...register('name', { required: true })} id="team-name" width={60} />
                </Field>
                <Field
                  label={
                    <Label>
                      <span>Email</span>
                      <Tooltip content="This is optional and is primarily used for allowing custom team avatars.">
                        <Icon name="info-circle" style={{ marginLeft: 6 }} />
                      </Tooltip>
                    </Label>
                  }
                >
                  <Input {...register('email')} type="email" placeholder="email@test.com" width={60} />
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

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'teams'),
  };
}

export default connect(mapStateToProps)(CreateTeam);
