import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { ErrorContainer } from './ErrorContainer';
var makeError = function (propOverrides) {
    var queryError = {
        data: {
            message: 'Error data message',
            error: 'Error data content',
        },
        message: 'Error message',
        status: 'Error status',
        statusText: 'Error status text',
        refId: 'A',
    };
    Object.assign(queryError, propOverrides);
    return queryError;
};
var setup = function (propOverrides) {
    var props = {
        queryError: makeError(propOverrides),
    };
    var wrapper = shallow(React.createElement(ErrorContainer, __assign({}, props)));
    return wrapper;
};
describe('ErrorContainer', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=ErrorContainer.test.js.map