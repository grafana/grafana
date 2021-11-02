import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { OrgDetailsPage } from './OrgDetailsPage';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setOrganizationName } from './state/reducers';
var setup = function (propOverrides) {
    var props = {
        organization: {},
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Org details',
            },
        },
        loadOrganization: jest.fn(),
        setOrganizationName: mockToolkitActionCreator(setOrganizationName),
        updateOrganization: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(OrgDetailsPage, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render organization and preferences', function () {
        var wrapper = setup({
            organization: {
                name: 'Cool org',
                id: 1,
            },
            preferences: {
                homeDashboardId: 1,
                theme: 'Default',
                timezone: 'Default',
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=OrgDetailsPage.test.js.map