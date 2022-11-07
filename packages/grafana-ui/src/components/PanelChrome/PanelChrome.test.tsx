import { screen, render } from '@testing-library/react';
import React from 'react';

import { PanelChrome } from './PanelChrome';

const setup = () => {
  render(
    <PanelChrome width={100} height={100}>
      {(innerWidth, innerHeight) => {
        return <div style={{ width: innerWidth, height: innerHeight, color: 'pink' }}>Panel&apos;s Content</div>;
      }}
    </PanelChrome>
  );
};

it('renders an empty panel with required props only', () => {
  setup();
  expect(screen.getByText("Panel's Content")).toBeInTheDocument();
});
