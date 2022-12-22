import { css } from '@emotion/css';
import React, { Component } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Form, HorizontalGroup, Select, stylesFactory } from '@grafana/ui';
import { TeamPicker } from 'app/core/components/Select/TeamPicker';
import { UserPicker } from 'app/core/components/Select/UserPicker';
import config from 'app/core/config';
import { OrgUser, Team } from 'app/types';
import {
  dashboardPermissionLevels,
  dashboardAclTargets,
  AclTarget,
  PermissionLevel,
  NewDashboardAclItem,
  OrgRole,
} from 'app/types/acl';

import { CloseButton } from '../CloseButton/CloseButton';

export interface Props {
  onAddPermission: (item: NewDashboardAclItem) => void;
  onCancel: () => void;
}

class AddPermissions extends Component<Props, NewDashboardAclItem> {
  static defaultProps = {
    showPermissionLevels: true,
  };

  constructor(props: Props) {
    super(props);
    this.state = this.getCleanState();
  }

  getCleanState() {
    return {
      userId: 0,
      teamId: 0,
      role: undefined,
      type: AclTarget.Team,
      permission: PermissionLevel.View,
    };
  }

  onTypeChanged = (item: SelectableValue<AclTarget>) => {
    const type = item.value;

    switch (type) {
      case AclTarget.User:
      case AclTarget.Team:
        this.setState({ type: type, userId: 0, teamId: 0, role: undefined });
        break;
      case AclTarget.Editor:
        this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Editor });
        break;
      case AclTarget.Viewer:
        this.setState({ type: type, userId: 0, teamId: 0, role: OrgRole.Viewer });
        break;
    }
  };

  onUserSelected = (user: SelectableValue<OrgUser['userId']>) => {
    this.setState({ userId: user && !Array.isArray(user) ? user.id : 0 });
  };

  onTeamSelected = (team: SelectableValue<Team>) => {
    this.setState({ teamId: team.value?.id && !Array.isArray(team.value) ? team.value.id : 0 });
  };

  onPermissionChanged = (permission: SelectableValue<PermissionLevel>) => {
    this.setState({ permission: permission.value! });
  };

  onSubmit = async () => {
    await this.props.onAddPermission(this.state);
    this.setState(this.getCleanState());
  };

  isValid() {
    switch (this.state.type) {
      case AclTarget.Team:
        return this.state.teamId > 0;
      case AclTarget.User:
        return this.state.userId > 0;
    }
    return true;
  }

  render() {
    const { onCancel } = this.props;
    const newItem = this.state;
    const pickerClassName = 'min-width-20';
    const isValid = this.isValid();
    const styles = getStyles(config.theme2);

    return (
      <div className="cta-form">
        <CloseButton onClick={onCancel} />
        <h5>Add Permission For</h5>
        <Form maxWidth="none" onSubmit={this.onSubmit}>
          {() => (
            <HorizontalGroup>
              <Select
                aria-label="Role to add new permission to"
                isSearchable={false}
                value={this.state.type}
                options={dashboardAclTargets}
                onChange={this.onTypeChanged}
              />

              {newItem.type === AclTarget.User ? (
                <UserPicker onSelected={this.onUserSelected} className={pickerClassName} />
              ) : null}

              {newItem.type === AclTarget.Team ? (
                <TeamPicker onSelected={this.onTeamSelected} className={pickerClassName} />
              ) : null}

              <span className={styles.label}>Can</span>

              <Select
                aria-label="Permission level"
                isSearchable={false}
                value={this.state.permission}
                options={dashboardPermissionLevels}
                onChange={this.onPermissionChanged}
                width={25}
              />
              <Button data-save-permission type="submit" disabled={!isValid}>
                Save
              </Button>
            </HorizontalGroup>
          )}
        </Form>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.primary.text};
    font-weight: bold;
  `,
}));

export default AddPermissions;
