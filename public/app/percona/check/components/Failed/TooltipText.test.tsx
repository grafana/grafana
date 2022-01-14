import React from 'react';
import { shallow } from 'enzyme';
import { TooltipText } from './TooltipText';

describe('TooltipText::', () => {
  it('should render a header with a sum of failed checks', () => {
    const root = shallow(<TooltipText sum={5} data={[1, 3, 1]} />);

    expect(root.find('div > div').at(0).text()).toEqual('Failed checks: 5');
  });

  it('should render a body with failed checks detailed by severity', () => {
    const outer = shallow(<TooltipText sum={5} data={[1, 3, 1]} />);
    const root = outer.find('div > div > div');

    expect(root.at(0).text()).toEqual('Critical – 1');
    expect(root.at(1).text()).toEqual('Major – 3');
    expect(root.at(2).text()).toEqual('Trivial – 1');
  });

  it('should render nothing when the sum is zero', () => {
    const outer = shallow(<TooltipText sum={0} data={[0, 0, 0]} />);
    const root = outer.find('div');

    expect(root.length).toEqual(0);
  });
});
