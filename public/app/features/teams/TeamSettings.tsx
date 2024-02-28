import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { PluginExtensionComponent, PluginExtensionPoints } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Input, Field, Button, FieldSet, Stack, Tab, TabsBar, TabContent } from '@grafana/ui';
import { TeamRolePicker } from 'app/core/components/RolePicker/TeamRolePicker';
import { updateTeamRoles } from 'app/core/components/RolePicker/api';
import { useRoleOptions } from 'app/core/components/RolePicker/hooks';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
// import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role, Team } from 'app/types';

import { updateTeam } from './state/actions';

const TAB_QUERY_PARAM = 'tab';
const GENERAL_SETTINGS_TAB = 'general';

type TabInfo = {
  id: string;
  title: string;
};

const mapDispatchToProps = {
  updateTeam,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps {
  team: Team;
}
export type Props = ConnectedProps<typeof connector> & OwnProps;

export const TeamSettings = ({ team, updateTeam }: Props) => {
  const [queryParams, updateQueryParams] = useQueryParams();
  const tabQueryParam = queryParams[TAB_QUERY_PARAM];
  const [activeTab, setActiveTab] = useState<string>(
    typeof tabQueryParam === 'string' ? tabQueryParam : GENERAL_SETTINGS_TAB
  );

  const canWriteTeamSettings = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsWrite, team);
  const currentOrgId = contextSrv.user.orgId;

  const [{ roleOptions }] = useRoleOptions(currentOrgId);
  const [pendingRoles, setPendingRoles] = useState<Role[]>([]);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<Team>({ defaultValues: team });

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  const canListRoles =
    contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRolesList, team) &&
    contextSrv.hasPermission(AccessControlAction.ActionRolesList);

  const onSubmit = async (formTeam: Team) => {
    if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles) {
      await updateTeamRoles(pendingRoles, team.id);
    }
    updateTeam(formTeam.name, formTeam.email || '');
  };

  const extensionComponents = useMemo(() => {
    const { extensions } = getPluginComponentExtensions({
      extensionPointId: PluginExtensionPoints.TeamProfileTab,
      // TODO: do we need to pass the team id to the context?
      context: {},
    });

    return extensions;
  }, []);

  const groupedExtensionComponents = extensionComponents.reduce<Record<string, PluginExtensionComponent[]>>(
    (acc, extension) => {
      const { title } = extension;
      if (acc[title]) {
        acc[title].push(extension);
      } else {
        acc[title] = [extension];
      }
      return acc;
    },
    {}
  );

  const convertExtensionComponentTitleToTabId = (title: string) => title.toLowerCase();

  const showTabs = extensionComponents.length > 0;
  const tabs: TabInfo[] = [
    {
      id: GENERAL_SETTINGS_TAB,
      // title: t('user-profile.tabs.general', 'General'), TODO:
      title: 'General',
    },
    ...Object.keys(groupedExtensionComponents).map((title) => ({
      id: convertExtensionComponentTitleToTabId(title),
      title,
    })),
  ];

  const TeamSettingsContent = () => (
    <Stack direction={'column'} gap={3}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
        <FieldSet label="Team details">
          <Field
            label="Name"
            disabled={!canWriteTeamSettings}
            required
            invalid={!!errors.name}
            error="Name is required"
          >
            <Input {...register('name', { required: true })} id="name-input" />
          </Field>

          {contextSrv.licensedAccessControlEnabled() && canListRoles && (
            <Field label="Role">
              <TeamRolePicker
                teamId={team.id}
                roleOptions={roleOptions}
                disabled={!canUpdateRoles}
                apply={true}
                onApplyRoles={setPendingRoles}
                pendingRoles={pendingRoles}
                maxWidth="100%"
              />
            </Field>
          )}

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
        </FieldSet>
      </form>
      <SharedPreferences resourceUri={`teams/${team.id}`} disabled={!canWriteTeamSettings} preferenceType="team" />
    </Stack>
  );

  const TeamSettingsContentWithTabs = () => (
    <div data-testid={selectors.components.TeamSettings.extensionPointTabs}>
      <Stack direction={'column'} gap={3}>
        <TabsBar>
          {tabs.map(({ id, title }) => {
            return (
              <Tab
                key={id}
                label={title}
                active={activeTab === id}
                onChangeTab={() => {
                  setActiveTab(id);
                  updateQueryParams({ [TAB_QUERY_PARAM]: id });
                }}
                data-testid={selectors.components.TeamSettings.extensionPointTab(id)}
              />
            );
          })}
        </TabsBar>
        <TabContent>
          {activeTab === GENERAL_SETTINGS_TAB && <TeamSettingsContent />}
          {Object.entries(groupedExtensionComponents).map(([title, pluginExtensionComponents]) => {
            const tabId = convertExtensionComponentTitleToTabId(title);

            if (activeTab === tabId) {
              return (
                <React.Fragment key={tabId}>
                  {pluginExtensionComponents.map(({ component: Component }, index) => (
                    <Component key={`${tabId}-${index}`} />
                  ))}
                </React.Fragment>
              );
            }
            return null;
          })}
        </TabContent>
      </Stack>
    </div>
  );

  if (showTabs) {
    return <TeamSettingsContentWithTabs />;
  }
  return <TeamSettingsContent />;
};

export default connector(TeamSettings);
