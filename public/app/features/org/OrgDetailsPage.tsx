import { memo, useEffect } from 'react';
import { type ConnectedProps, connect } from 'react-redux';

import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { SharedPreferences } from 'app/core/components/SharedPreferences/SharedPreferences';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { ShowConfirmModalEvent } from 'app/types/events';
import { type StoreState } from 'app/types/store';

import OrgProfile from './OrgProfile';
import { loadOrganization, updateOrganization } from './state/actions';
import { setOrganizationName } from './state/reducers';

interface OwnProps {}

export const OrgDetailsPage = memo(function OrgDetailsPage({
  navModel,
  organization,
  loadOrganization,
  setOrganizationName,
  updateOrganization,
}: Props) {
  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const onUpdateOrganization = (orgName: string) => {
    setOrganizationName(orgName);
    updateOrganization();
  };

  const handleConfirm = () => {
    return new Promise<boolean>((resolve) => {
      appEvents.publish(
        new ShowConfirmModalEvent({
          title: t('org.org-details-page.title.confirm-preferences-update', 'Confirm preferences update'),
          text: 'This will update the preferences for the whole organization. Are you sure you want to update the preferences?',
          yesText: 'Save',
          yesButtonVariant: 'primary',
          onConfirm: async () => resolve(true),
          onDismiss: async () => resolve(false),
        })
      );
    });
  };

  const isLoading = Object.keys(organization).length === 0;
  const canReadOrg = contextSrv.hasPermission(AccessControlAction.OrgsRead);
  const canReadPreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesRead);
  const canWritePreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesWrite);

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={isLoading}>
        {!isLoading && (
          <Stack direction="column" gap={3}>
            {canReadOrg && <OrgProfile onSubmit={onUpdateOrganization} orgName={organization.name} />}
            {canReadPreferences && (
              <SharedPreferences
                resourceUri="org"
                disabled={!canWritePreferences}
                preferenceType="org"
                onConfirm={handleConfirm}
              />
            )}
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
});

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'org-settings'),
    organization: state.organization.organization,
  };
}

const mapDispatchToProps = {
  loadOrganization,
  setOrganizationName,
  updateOrganization,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = OwnProps & ConnectedProps<typeof connector>;

export default connector(OrgDetailsPage);
