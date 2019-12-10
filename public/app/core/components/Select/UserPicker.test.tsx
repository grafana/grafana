import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { UserPicker } from './UserPicker';
import { backendSrv } from 'app/core/services/backend_srv';

jest.spyOn(backendSrv, 'get').mockImplementation(() => Promise.resolve([]));

describe('UserPicker', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<UserPicker onSelected={() => {}} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
