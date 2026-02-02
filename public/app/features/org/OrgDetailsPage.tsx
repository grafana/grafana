import { PureComponent, Suspense, lazy } from 'react';
import { ConnectedProps, connect } from 'react-redux';

import { Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { appEvents, contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { getNavModel } from 'app/core/selectors/navModel';
import { AccessControlAction, StoreState } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { isOrgAdmin } from '../plugins/admin/permissions';

import OrgProfile from './OrgProfile';
import { loadOrganization, updateOrganization } from './state/actions';
import { setOrganizationName } from './state/reducers';
// BMC code
const ToggleFeature = lazy(() => {
  return import('../feature-status/ToggleFeature');
});
// End

interface OwnProps {}

export class OrgDetailsPage extends PureComponent<Props> {
  async componentDidMount() {
    await this.props.loadOrganization();
  }

  onUpdateOrganization = (orgName: string) => {
    this.props.setOrganizationName(orgName);
    this.props.updateOrganization();
  };

  handleConfirm = () => {
    return new Promise<boolean>((resolve) => {
      appEvents.publish(
        new ShowConfirmModalEvent({
          // BMC Change: Next couple lines
          title: t('bmcgrafana.shared-preferences.confirm-modal.title', 'Confirm preferences update'),
          text: t(
            'bmcgrafana.shared-preferences.confirm-modal.body',
            'This will update the preferences for the whole organization. Are you sure you want to update the preferences?'
          ),
          yesText: t('common.save', 'Save'),
          yesButtonVariant: 'primary',
          onConfirm: async () => resolve(true),
          onDismiss: async () => resolve(false),
        })
      );
    });
  };

  render() {
    const { navModel, organization } = this.props;
    const isLoading = Object.keys(organization).length === 0;
    const canReadOrg = contextSrv.hasPermission(AccessControlAction.OrgsRead);
    const canReadPreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesRead);
    const canWritePreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesWrite);

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={isLoading}>
          {!isLoading && (
            <Stack direction="column" gap={3}>
              {canReadOrg && <OrgProfile onSubmit={this.onUpdateOrganization} orgName={organization.name} />}
              {canReadPreferences && (
                <SharedPreferences
                  resourceUri="org"
                  disabled={!canWritePreferences}
                  preferenceType="org"
                  onConfirm={this.handleConfirm}
                />
              )}
              {/* BMC code */}
              {isOrgAdmin() && (
                <Suspense fallback={<></>}>
                  <ToggleFeature />
                </Suspense>
              )}
              {/* End */}
            </Stack>
          )}
        </Page.Contents>
      </Page>
    );
  }
}

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
