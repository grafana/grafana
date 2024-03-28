import React, { PureComponent } from 'react';
import { ConnectedProps, connect } from 'react-redux';

import { PluginExtensionComponent, PluginExtensionPoints } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getPluginComponentExtensions } from '@grafana/runtime';
import { Tab, TabsBar, TabContent, VerticalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { appEvents, contextSrv } from 'app/core/core';
// import { useQueryParams } from 'app/core/hooks/useQueryParams';
// import { t } from 'app/core/internationalization';
import { getNavModel } from 'app/core/selectors/navModel';
import { AccessControlAction, StoreState } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import OrgProfile from './OrgProfile';
import { loadOrganization, updateOrganization } from './state/actions';
import { setOrganizationName } from './state/reducers';

// const TAB_QUERY_PARAM = 'tab';
const GENERAL_SETTINGS_TAB = 'general';

type TabInfo = {
  id: string;
  title: string;
};

interface OwnProps {}

interface State {
  activeTab: string;
}

// TODO: what is the equivalent of useQueryParams in class components?
export class OrgDetailsPage extends PureComponent<Props, State> {
  state: State = {
    activeTab: GENERAL_SETTINGS_TAB,
  };

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
          title: 'Confirm preferences update',
          text: 'This will update the preferences for the whole organization. Are you sure you want to update the preferences?',
          yesText: 'Save',
          yesButtonVariant: 'primary',
          onConfirm: async () => resolve(true),
          onDismiss: async () => resolve(false),
        })
      );
    });
  };

  getGroupedPluginComponentExtensions() {
    const { extensions: extensionComponents } = getPluginComponentExtensions({
      extensionPointId: PluginExtensionPoints.OrganizationProfileTab,
      context: {},
    });

    return extensionComponents.reduce<Record<string, PluginExtensionComponent[]>>((acc, extension) => {
      const { title } = extension;
      if (acc[title]) {
        acc[title].push(extension);
      } else {
        acc[title] = [extension];
      }
      return acc;
    }, {});
  }

  convertExtensionComponentTitleToTabId(title: string) {
    return title.toLowerCase();
  }

  renderOrgDetails() {
    const { organization } = this.props;
    const canReadOrg = contextSrv.hasPermission(AccessControlAction.OrgsRead);
    const canReadPreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesRead);
    const canWritePreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesWrite);

    return (
      <VerticalGroup spacing="lg">
        {canReadOrg && <OrgProfile onSubmit={this.onUpdateOrganization} orgName={organization.name} />}
        {canReadPreferences && (
          <SharedPreferences
            resourceUri="org"
            disabled={!canWritePreferences}
            preferenceType="org"
            onConfirm={this.handleConfirm}
          />
        )}
      </VerticalGroup>
    );
  }

  renderOrgDetailsWithTabs() {
    const { activeTab } = this.state;

    const groupedExtensionComponents = this.getGroupedPluginComponentExtensions();

    const tabs: TabInfo[] = [
      {
        id: GENERAL_SETTINGS_TAB,
        title: 'General',
        // title: t('user-profile.tabs.general', 'General'), TODO:
      },
      ...Object.keys(groupedExtensionComponents).map((title) => ({
        id: this.convertExtensionComponentTitleToTabId(title),
        title,
      })),
    ];

    return (
      <div data-testid={selectors.components.OrgDetails.extensionPointTabs} style={{ marginTop: '10px' }}>
        <TabsBar>
          {tabs.map(({ id, title }) => {
            return (
              <Tab
                key={id}
                label={title}
                active={activeTab === id}
                onChangeTab={() => {
                  this.setState({ activeTab: id });
                  // updateQueryParams({ [TAB_QUERY_PARAM]: id }); TODO:
                }}
                data-testid={selectors.components.OrgDetails.extensionPointTab(id)}
              />
            );
          })}
        </TabsBar>
        <TabContent>
          {activeTab === GENERAL_SETTINGS_TAB && this.renderOrgDetails()}
          {Object.entries(groupedExtensionComponents).map(([title, pluginExtensionComponents]) => {
            const tabId = this.convertExtensionComponentTitleToTabId(title);

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
      </div>
    );
  }

  render() {
    const { navModel, organization } = this.props;
    const groupedExtensionComponents = this.getGroupedPluginComponentExtensions();
    const showTabs = Object.keys(groupedExtensionComponents).length > 0;

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={!organization}>
          {showTabs ? this.renderOrgDetailsWithTabs() : this.renderOrgDetails()}
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
