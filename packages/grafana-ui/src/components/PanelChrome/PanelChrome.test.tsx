import { screen, render } from '@testing-library/react';
import React from 'react';

import { PanelChrome, PanelChromeProps } from './PanelChrome';

const setup = (propOverrides?: Partial<PanelChromeProps>) => {
  const props: PanelChromeProps = {
    width: 100,
    height: 100,
    children: (innerWidth, innerHeight) => {
      return <div style={{ width: innerWidth, height: innerHeight, color: 'pink' }}>Panel&apos;s Content</div>;
    },
  };

  Object.assign(props, propOverrides);
  render(<PanelChrome {...props} />);
};

it('renders an empty panel with required props only', () => {
  setup();
  expect(screen.getByText("Panel's Content")).toBeInTheDocument();
});

it('renders an empty panel without padding', () => {
  setup({ padding: 'none' });
  expect(screen.getByText("Panel's Content").parentElement).toHaveStyle({ padding: '0px' });
});

it('renders an empty panel with padding', () => {
  setup({ padding: 'md' });
  expect(screen.getByText("Panel's Content").offsetHeight).not.toBe(100);
  expect(screen.getByText("Panel's Content").parentElement).not.toHaveStyle({ padding: '0px' });
});
