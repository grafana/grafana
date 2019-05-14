import React from 'react';
import { shallow } from 'enzyme';
import BottomSection from './BottomSection';
jest.mock('../../config', function () { return ({
    bootData: {
        navTree: [
            {
                id: 'profile',
                hideFromMenu: true,
            },
            {
                hideFromMenu: true,
            },
            {
                hideFromMenu: false,
            },
            {
                hideFromMenu: true,
            },
        ],
    },
    user: {
        orgCount: 5,
        orgName: 'Grafana',
    },
}); });
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        sidemenu: true,
        isSignedIn: false,
        isGrafanaAdmin: false,
        hasEditPermissionFolders: false,
    },
}); });
describe('Render', function () {
    it('should render component', function () {
        var wrapper = shallow(React.createElement(BottomSection, null));
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=BottomSection.test.js.map