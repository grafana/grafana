import React from 'react';
import renderer from 'react-test-renderer';
import GrafanaScrollbar from './GrafanaScrollbar';

describe('GrafanaScrollbar', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <GrafanaScrollbar>
          <p>Scrollable content</p>
        </GrafanaScrollbar>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
