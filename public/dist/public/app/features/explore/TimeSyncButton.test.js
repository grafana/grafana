import React from 'react';
import { TimeSyncButton } from './TimeSyncButton';
import { mount } from 'enzyme';
var setup = function (isSynced) {
    var onClick = function () { };
    return mount(React.createElement(TimeSyncButton, { onClick: onClick, isSynced: isSynced }));
};
describe('TimeSyncButton', function () {
    it('should change style when synced', function () {
        var wrapper = setup(true);
        expect(wrapper.find('button').props()['aria-label']).toEqual('Synced times');
    });
    it('should not change style when not synced', function () {
        var wrapper = setup(false);
        expect(wrapper.find('button').props()['aria-label']).toEqual('Unsynced times');
    });
});
//# sourceMappingURL=TimeSyncButton.test.js.map