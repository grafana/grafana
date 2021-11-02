import React from 'react';
import { mount, shallow } from 'enzyme';
import { Dimensions } from './';
describe('Dimensions', function () {
    it('renders', function () {
        mount(React.createElement(Dimensions, { dimensions: {}, onChange: function (dimensions) { return console.log(dimensions); }, loadKeys: function () { return Promise.resolve([]); }, loadValues: function () { return Promise.resolve([]); } }));
    });
    describe('and no dimension were passed to the component', function () {
        it('initially displays just an add button', function () {
            var wrapper = shallow(React.createElement(Dimensions, { dimensions: {}, onChange: function () { }, loadKeys: function () { return Promise.resolve([]); }, loadValues: function () { return Promise.resolve([]); } }));
            expect(wrapper.html()).toEqual(expect.stringContaining("gf-form"));
        });
    });
    describe('and one dimension key along with a value were passed to the component', function () {
        it('initially displays the dimension key, value and an add button', function () {
            var wrapper = shallow(React.createElement(Dimensions, { dimensions: { somekey: 'somevalue' }, onChange: function () { }, loadKeys: function () { return Promise.resolve([]); }, loadValues: function () { return Promise.resolve([]); } }));
            expect(wrapper.html()).toEqual(expect.stringContaining("gf-form"));
        });
    });
});
//# sourceMappingURL=Dimensions.test.js.map