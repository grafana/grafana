import { render, screen } from '@testing-library/react';
import React from 'react';

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
        config={{
          links: [
            {
              title: 'Link1',
              url: '/link1',
            },
            {
              title: 'Link2',
              url: '/link2',
            },
          ],
        }}
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
        config={{
          links: [
            {
              title: 'Link1',
              url: '/link1',
            },
          ],
        }}
      >
        {() => {
          return <div aria-label="fake aria label" />;
        }}
      </DataLinksContextMenu>
    );

    expect(screen.getByLabelText(fakeAriaLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(selectors.components.DataLinksContextMenu.singleLink)).toBeInTheDocument();
  });
});
