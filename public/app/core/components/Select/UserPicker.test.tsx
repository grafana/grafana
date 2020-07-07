import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { UserPicker } from './UserPicker';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ get: jest.fn().mockResolvedValue([]) }),
}));

describe('UserPicker', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<UserPicker onSelected={() => {}} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
