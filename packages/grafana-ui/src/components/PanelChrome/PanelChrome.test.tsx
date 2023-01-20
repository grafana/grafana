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
  return render(<PanelChrome {...props} />);
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

  expect(screen.getByText("Panel's Content").style.getPropertyValue('height')).not.toBe('100px');
  expect(screen.getByText("Panel's Content").parentElement).not.toHaveStyle({ padding: '0px' });
});

it('renders panel with a header if prop title', () => {
  setup({ title: 'Test Panel Header' });

  expect(screen.getByTestId('header-container')).toBeInTheDocument();
});

it('renders panel with a header with title in place if prop title', () => {
  setup({ title: 'Test Panel Header' });

  expect(screen.getByText('Test Panel Header')).toBeInTheDocument();
});

it('renders panel with a header if prop titleItems', () => {
  setup({
    titleItems: [<div key="title-item-test"> This should be a self-contained node </div>],
  });

  expect(screen.getByTestId('header-container')).toBeInTheDocument();
});

it('renders panel with a header with icons in place if prop titleItems', () => {
  setup({
    titleItems: [<div key="title-item-test"> This should be a self-contained node </div>],
  });

  expect(screen.getByTestId('title-items-container')).toBeInTheDocument();
});

it.skip('renders panel with a fixed header if prop hoverHeader is false', () => {
  // setup({ title: 'Test Panel Header', hoverHeader: false });
  // expect(screen.getByTestId('header-container')).toBeInTheDocument();
});

it('renders panel with a header if prop menu', () => {
  setup({ menu: <div> Menu </div> });

  expect(screen.getByTestId('header-container')).toBeInTheDocument();
});

it('renders panel with a show-on-hover menu icon if prop menu', () => {
  setup({ menu: <div> Menu </div> });

  expect(screen.getByTestId('panel-menu-button')).toBeInTheDocument();
  expect(screen.getByTestId('panel-menu-button')).not.toBeVisible();
});

it.skip('renders states in the panel header if any given', () => {});

it.skip('renders leftItems in the panel header if any given when no states prop is given', () => {});

it.skip('renders states in the panel header if both leftItems and states are given', () => {});
