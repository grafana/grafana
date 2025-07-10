import { render, screen } from '@testing-library/react';

import { Field, FieldType, LinkModel } from '@grafana/data';

import { TableCellDisplayMode } from '../../types';

import { DataLinksCell } from './DataLinksCell';

describe('DataLinksCell', () => {
  describe('Displays data Links', () => {
    const getFieldWithLinks = (links: LinkModel[]): Field => {
      return {
        name: 'Category',
        type: FieldType.string,
        values: ['A', 'B', 'A', 'B', 'A'],
        config: {
          custom: {
            cellOptions: {
              type: TableCellDisplayMode.Auto,
              wrapText: false,
            },
          },
        },
        display: (value: unknown) => ({
          text: String(value),
          numeric: 0,
          color: undefined,
          prefix: undefined,
          suffix: undefined,
        }),
        state: {},
        getLinks: () => links,
      };
    };

    it('shows multiple datalinks in separate spans', () => {
      const linksForField = [
        { href: 'http://asdasd.com', title: 'Test Title' } as LinkModel,
        { href: 'http://asdasd2.com', title: 'Test Title2' } as LinkModel,
      ];

      jest.mock('../utils', () => ({
        getCellLinks: () => linksForField,
      }));

      const field = getFieldWithLinks(linksForField);

      render(<DataLinksCell field={field} rowIdx={0} />);

      linksForField.forEach((link) => {
        expect(screen.getByRole('link', { name: link.title })).toHaveAttribute('href', link.href);
      });
    });

    it('Does not create a link if href is missing from link', () => {
      const linksForField = [
        { href: 'http://asdasd.com', title: 'Test Title' } as LinkModel,
        { title: 'Test Title2' } as LinkModel,
      ];

      jest.mock('../utils', () => ({
        getCellLinks: () => linksForField,
      }));

      const field = getFieldWithLinks(linksForField);

      render(<DataLinksCell field={field} rowIdx={0} />);

      linksForField.forEach((link) => {
        if (link.href !== undefined) {
          expect(screen.getByRole('link', { name: link.title })).toHaveAttribute('href', link.href);
        } else {
          expect(screen.queryByRole('link', { name: link.title })).not.toBeInTheDocument();
          expect(screen.queryByText(link.title)).not.toBeInTheDocument();
        }
      });
    });
  });
});
