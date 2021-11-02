import React from 'react';
import { QueryOperationAction } from './QueryOperationAction';
import { shallow } from 'enzyme';
describe('QueryOperationAction', function () {
    it('renders', function () {
        expect(function () { return shallow(React.createElement(QueryOperationAction, { title: "test", icon: "panel-add", onClick: function () { } })); }).not.toThrow();
    });
    describe('when disabled', function () {
        it('does not call onClick handler', function () {
            var clickSpy = jest.fn();
            var wrapper = shallow(React.createElement(QueryOperationAction, { icon: "panel-add", onClick: clickSpy, title: "Test action" }));
            var actionEl = wrapper.find({ 'aria-label': 'Test action query operation action' });
            expect(actionEl).toHaveLength(1);
            expect(clickSpy).not.toBeCalled();
            actionEl.first().simulate('click');
            expect(clickSpy).toBeCalledTimes(1);
        });
    });
});
//# sourceMappingURL=QueryOperationAction.test.js.map