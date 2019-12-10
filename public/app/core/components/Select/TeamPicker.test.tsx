import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { TeamPicker } from './TeamPicker';
import { backendSrv } from 'app/core/services/backend_srv';

jest.spyOn(backendSrv, 'get').mockImplementation(() => Promise.resolve([]));

describe('TeamPicker', () => {
  it('renders correctly', () => {
    const props = {
      onSelected: () => {},
    };
    const tree = renderer.create(<TeamPicker {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
