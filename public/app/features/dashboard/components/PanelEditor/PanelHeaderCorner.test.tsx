import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

// @todo: replace barrel import path
import { PanelModel } from '../../state/index';

import PanelHeaderCorner, { Props } from './PanelHeaderCorner';

const setup = () => {
  const testPanel = new PanelModel({ title: 'test', description: 'test panel' });
  const props: Props = {
    panel: testPanel,
  };
  return render(<PanelHeaderCorner {...props} />);
};

describe('Panel header corner test', () => {
  it('should render component', () => {
    setup();

    expect(
      screen.getByRole('button', { name: selectors.components.Panels.Panel.headerCornerInfo('info') })
    ).toBeInTheDocument();
  });
});
