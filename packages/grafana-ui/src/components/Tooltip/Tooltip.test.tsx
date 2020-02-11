import React from 'react';
import renderer from 'react-test-renderer';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <Tooltip placement="auto" content="Tooltip text">
          <a className="test-class" href="http://www.grafana.com">
            Link with tooltip
          </a>
        </Tooltip>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
