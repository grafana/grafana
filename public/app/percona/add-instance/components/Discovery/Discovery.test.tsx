import { shallow } from 'enzyme';
import React from 'react';
import Credentials from './components/Credentials/Credentials';
import { DiscoveryDocs } from './components/DiscoveryDocs/DiscoveryDocs';
import Instances from './components/Instances/Instances';
import Discovery from './Discovery';

describe('Discovery:: ', () => {
  it('should render credentials, instances and docs', () => {
    const root = shallow(<Discovery selectInstance={jest.fn()} />);

    expect(root.find(Credentials).exists()).toBeTruthy();
    expect(root.find(Instances).exists()).toBeTruthy();
    expect(root.find(DiscoveryDocs).exists()).toBeTruthy();
  });
});
