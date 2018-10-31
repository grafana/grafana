import React from 'react';
import renderer from 'react-test-renderer';
import EmptyListCTA from './EmptyListCTA';

const model = {
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

describe('EmptyListCTA', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<EmptyListCTA model={model} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
