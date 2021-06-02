import React from 'react';
import { shallow } from 'enzyme';
import { activeCheckStub } from 'app/percona/check/__mocks__/stubs';
import { TableBody } from './TableBody';

describe('TableBody::', () => {
  it('renders a table body', () => {
    const root = shallow(<TableBody data={activeCheckStub} />);

    expect(root.find('tbody > tr').length).toEqual(5);
  });

  it('should render a specific text in the first row/col', () => {
    const root = shallow(<TableBody data={activeCheckStub} />);

    expect(
      root
        .find('tbody > tr')
        .at(0)
        .find('td')
        .at(0)
        .text()
    ).toEqual('sandbox-mysql.acme.com');
  });
});
