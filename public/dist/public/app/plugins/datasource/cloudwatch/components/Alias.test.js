import React from 'react';
import renderer from 'react-test-renderer';
import { Alias } from './Alias';
describe('Alias', function () {
    it('should render component', function () {
        var tree = renderer.create(React.createElement(Alias, { value: 'legend', onChange: function () { } })).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
//# sourceMappingURL=Alias.test.js.map