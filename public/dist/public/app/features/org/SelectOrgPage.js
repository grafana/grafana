import { __awaiter } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { useEffectOnce } from 'react-use';
import { config } from '@grafana/runtime';
import { Button, HorizontalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getUserOrganizations, setUserOrganization } from './state/actions';
const navModel = {
    main: {
        icon: 'grafana',
        subTitle: 'Preferences',
        text: 'Select active organization',
    },
    node: {
        text: 'Select active organization',
    },
};
const mapStateToProps = (state) => {
    return {
        userOrgs: state.organization.userOrgs,
    };
};
const mapDispatchToProps = {
    setUserOrganization,
    getUserOrganizations,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const SelectOrgPage = ({ setUserOrganization, getUserOrganizations, userOrgs }) => {
    const setUserOrg = (org) => __awaiter(void 0, void 0, void 0, function* () {
        yield setUserOrganization(org.orgId);
        window.location.href = config.appSubUrl + '/';
    });
    useEffectOnce(() => {
        getUserOrganizations();
    });
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("div", null,
                React.createElement("p", null, "You have been invited to another organization! Please select which organization that you want to use right now. You can change this later at any time."),
                React.createElement(HorizontalGroup, { wrap: true }, userOrgs &&
                    userOrgs.map((org) => (React.createElement(Button, { key: org.orgId, icon: "signin", onClick: () => setUserOrg(org) }, org.name))))))));
};
export default connector(SelectOrgPage);
//# sourceMappingURL=SelectOrgPage.js.map