import React from 'react';
import { shallow } from 'enzyme';
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
    const tree = shallow(<EmptyListCTA model={model} />);
    expect(tree).toMatchSnapshot();
  });
});
