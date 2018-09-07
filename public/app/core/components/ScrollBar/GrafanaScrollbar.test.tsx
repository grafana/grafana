import React from 'react';
import { mount } from 'enzyme';
import toJson from 'enzyme-to-json';
import GrafanaScrollbar from './GrafanaScrollbar';

describe('GrafanaScrollbar', () => {
  it('renders correctly', () => {
    const tree = mount(
      <GrafanaScrollbar>
        <p>Scrollable content</p>
      </GrafanaScrollbar>
    );
    expect(toJson(tree)).toMatchSnapshot();
  });
});
