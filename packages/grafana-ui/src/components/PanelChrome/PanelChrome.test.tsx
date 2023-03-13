import { screen, render } from '@testing-library/react';
import React from 'react';

import { LoadingState } from '@grafana/data';

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

// Check for backwards compatibility
it('renders panel header if prop title', () => {
  setup({ title: 'Test Panel Header' });

  expect(screen.getByTestId('header-container')).toBeInTheDocument();
});

// Check for backwards compatibility
it('renders panel with title in place if prop title', () => {
  setup({ title: 'Test Panel Header' });

  expect(screen.getByText('Test Panel Header')).toBeInTheDocument();
});

// Check for backwards compatibility
it('renders panel with a header if prop leftItems', () => {
  setup({
    leftItems: [<div key="left-item-test"> This should be a self-contained node </div>],
  });

  expect(screen.getByTestId('header-container')).toBeInTheDocument();
});

it('renders panel with a hovering header if prop hoverHeader is true', () => {
  setup({ title: 'Test Panel Header', hoverHeader: true });

  expect(screen.queryByTestId('header-container')).not.toBeInTheDocument();
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

it('renders panel with a show-on-hover menu icon if prop menu', () => {
  setup({ menu: <div> Menu </div> });

  expect(screen.getByTestId('panel-menu-button')).toBeInTheDocument();
  expect(screen.getByTestId('panel-menu-button')).not.toBeVisible();
});

it('renders error status in the panel header if any given', () => {
  setup({ statusMessage: 'Error test' });

  expect(screen.getByLabelText('Panel status')).toBeInTheDocument();
});

it('does not render error status in the panel header if loadingState is error, but no statusMessage', () => {
  setup({ loadingState: LoadingState.Error, statusMessage: '' });

  expect(screen.queryByTestId('panel-status')).not.toBeInTheDocument();
});

it('renders loading indicator in the panel header if loadingState is loading', () => {
  setup({ loadingState: LoadingState.Loading });

  expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
});

it('renders loading indicator in the panel header if loadingState is loading regardless of not having a header', () => {
  setup({ loadingState: LoadingState.Loading, hoverHeader: true });

  expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
});

it('renders loading indicator in the panel header if loadingState is loading regardless of having a header', () => {
  setup({ loadingState: LoadingState.Loading, hoverHeader: false });

  expect(screen.getByLabelText('Panel loading bar')).toBeInTheDocument();
});

it('renders streaming indicator in the panel header if loadingState is streaming', () => {
  setup({ loadingState: LoadingState.Streaming });

  expect(screen.getByTestId('panel-streaming')).toBeInTheDocument();
});
