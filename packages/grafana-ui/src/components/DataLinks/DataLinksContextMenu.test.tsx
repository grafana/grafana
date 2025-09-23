import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { DataLinksContextMenu } from './DataLinksContextMenu';

const fakeAriaLabel = 'fake aria label';
describe('DataLinksContextMenu', () => {
  it('renders context menu when there are more than one data links', () => {
    render(
      <DataLinksContextMenu
        links={() => [
          {
            href: '/link1',
            title: 'Link1',
            target: '_blank',
            origin: {},
          },
          {
            href: '/link2',
            title: 'Link2',
            target: '_blank',
            origin: {},
          },
        ]}
      >
        {() => {
          return <div aria-label="fake aria label" />;
        }}
      </DataLinksContextMenu>
    );

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.queryAllByLabelText(selectors.components.DataLinksContextMenu.singleLink)).toHaveLength(0);
  });

  it('renders link when there is a single data link', () => {
    render(
      <DataLinksContextMenu
        links={() => [
          {
            href: '/link1',
            title: 'Link1',
            target: '_blank',
            origin: {},
          },
        ]}
      >
        {() => {
          return <div aria-label="fake aria label" />;
        }}
      </DataLinksContextMenu>
    );

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink)).toBeInTheDocument();
  });
});
