import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import BottomNavLinks from './BottomNavLinks';
import appEvents from '../../app_events';
jest.mock('../../app_events', function () { return ({
    emit: jest.fn(),
}); });
var setup = function (propOverrides) {
    var props = Object.assign({
        link: {},
        user: {
            isGrafanaAdmin: false,
            isSignedIn: false,
            orgCount: 2,
            orgRole: '',
            orgId: 1,
            orgName: 'Grafana',
            timezone: 'UTC',
            helpFlags1: 1,
            lightTheme: false,
            hasEditPermissionInFolders: false,
        },
    }, propOverrides);
    return shallow(React.createElement(BottomNavLinks, tslib_1.__assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render organization switcher', function () {
        var wrapper = setup({
            link: {
                showOrgSwitcher: true,
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should render subtitle', function () {
        var wrapper = setup({
            link: {
                subTitle: 'subtitle',
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should render children', function () {
        var wrapper = setup({
            link: {
                children: [
                    {
                        id: '1',
                    },
                    {
                        id: '2',
                    },
                    {
                        id: '3',
                    },
                    {
                        id: '4',
                        hideFromMenu: true,
                    },
                ],
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
});
describe('Functions', function () {
    describe('item clicked', function () {
        var wrapper = setup();
        var mockEvent = { preventDefault: jest.fn() };
        it('should emit show modal event if url matches shortcut', function () {
            var child = { url: '/shortcuts' };
            var instance = wrapper.instance();
            instance.itemClicked(mockEvent, child);
            expect(appEvents.emit).toHaveBeenCalledWith('show-modal', { templateHtml: '<help-modal></help-modal>' });
        });
    });
});
//# sourceMappingURL=BottomNavLinks.test.js.map