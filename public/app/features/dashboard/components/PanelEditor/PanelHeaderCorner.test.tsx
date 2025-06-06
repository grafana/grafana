import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { PanelModel } from '../../state/PanelModel';

import { PanelHeaderCorner, Props } from './PanelHeaderCorner';

const setup = () => {
  const testPanel = new PanelModel({ title: 'test', description: 'test panel' });
  const props: Props = {
    panel: testPanel,
    theme: createTheme(),
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
