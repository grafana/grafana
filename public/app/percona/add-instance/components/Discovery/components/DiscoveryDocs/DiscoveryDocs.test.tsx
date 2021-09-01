import { mount } from 'enzyme';
import React from 'react';
import { DiscoveryDocs } from './DiscoveryDocs';

describe('DiscoveryDocs:: ', () => {
  it('should render list with two buttons for the docs', () => {
    const root = mount(<DiscoveryDocs />);

    expect(root.find('button').length).toBe(2);
  });
});
