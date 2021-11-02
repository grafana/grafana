import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { ApiKeysAddedModal } from './ApiKeysAddedModal';
var setup = function (propOverrides) {
    var props = {
        onDismiss: jest.fn(),
        apiKey: 'api key test',
        rootPath: 'test/path',
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(ApiKeysAddedModal, __assign({}, props)));
    return {
        wrapper: wrapper,
    };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=ApiKeysAddedModal.test.js.map