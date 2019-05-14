import React from 'react';
import renderer from 'react-test-renderer';
import EmptyListCTA from './EmptyListCTA';
var model = {
    title: 'Title',
    buttonIcon: 'ga css class',
    buttonLink: 'http://url/to/destination',
    buttonTitle: 'Click me',
    onClick: jest.fn(),
    proTip: 'This is a tip',
    proTipLink: 'http://url/to/tip/destination',
    proTipLinkTitle: 'Learn more',
    proTipTarget: '_blank',
};
describe('EmptyListCTA', function () {
    it('renders correctly', function () {
        var tree = renderer.create(React.createElement(EmptyListCTA, { model: model })).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
//# sourceMappingURL=EmptyListCTA.test.js.map