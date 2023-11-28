import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { VerticalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import SharedPreferences from 'app/core/components/SharedPreferences/SharedPreferences';
import { appEvents, contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import { AccessControlAction } from 'app/types';
import { ShowConfirmModalEvent } from 'app/types/events';
import OrgProfile from './OrgProfile';
import { loadOrganization, updateOrganization } from './state/actions';
import { setOrganizationName } from './state/reducers';
export class OrgDetailsPage extends PureComponent {
    constructor() {
        super(...arguments);
        this.onUpdateOrganization = (orgName) => {
            this.props.setOrganizationName(orgName);
            this.props.updateOrganization();
        };
        this.handleConfirm = () => {
            return new Promise((resolve) => {
                appEvents.publish(new ShowConfirmModalEvent({
                    title: 'Confirm preferences update',
                    text: 'This will update the preferences for the whole organization. Are you sure you want to update the preferences?',
                    yesText: 'Save',
                    yesButtonVariant: 'primary',
                    onConfirm: () => __awaiter(this, void 0, void 0, function* () { return resolve(true); }),
                    onDismiss: () => __awaiter(this, void 0, void 0, function* () { return resolve(false); }),
                }));
            });
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.props.loadOrganization();
        });
    }
    render() {
        const { navModel, organization } = this.props;
        const isLoading = Object.keys(organization).length === 0;
        const canReadOrg = contextSrv.hasPermission(AccessControlAction.OrgsRead);
        const canReadPreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesRead);
        const canWritePreferences = contextSrv.hasPermission(AccessControlAction.OrgsPreferencesWrite);
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading }, !isLoading && (React.createElement(VerticalGroup, { spacing: "lg" },
                canReadOrg && React.createElement(OrgProfile, { onSubmit: this.onUpdateOrganization, orgName: organization.name }),
                canReadPreferences && (React.createElement(SharedPreferences, { resourceUri: "org", disabled: !canWritePreferences, preferenceType: "org", onConfirm: this.handleConfirm })))))));
    }
}
function mapStateToProps(state) {
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
export default connect(mapStateToProps, mapDispatchToProps)(OrgDetailsPage);
//# sourceMappingURL=OrgDetailsPage.js.map