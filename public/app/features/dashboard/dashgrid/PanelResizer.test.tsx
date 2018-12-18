import React from 'react';
import renderer from 'react-test-renderer';
import { PanelResizer } from './PanelResizer';
import { PanelModel } from '../panel_model';

const panel = new PanelModel({ collapsed: false });

describe('PanelResizer', () => {
  it('renders correctly', () => {
    const tree = renderer
      .create(
        <PanelResizer isEditing={true} panel={panel}>
          <p>PanelResizer</p>
        </PanelResizer>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
