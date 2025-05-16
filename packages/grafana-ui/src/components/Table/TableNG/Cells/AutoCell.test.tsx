import { render, screen } from '@testing-library/react';

import { Field, FieldType, LinkModel } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import AutoCell from './AutoCell';

describe('AutoCell', () => {
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

    it('shows multiple datalinks in a context menu behind a button', () => {
      const linksForField = [
        { href: 'http://asdasd.com', title: 'Test Title' } as LinkModel,
        { href: 'http://asdasd2.com', title: 'Test Title2' } as LinkModel,
      ];

      jest.mock('../utils', () => ({
        getCellLinks: () => linksForField,
      }));

      const field = getFieldWithLinks(linksForField);

      render(
        <AutoCell
          value="test"
          field={field}
          justifyContent="normal"
          rowIdx={0}
          cellOptions={{ type: TableCellDisplayMode.Auto }}
        />
      );
      const submitButton = screen.getByRole('button');
      expect(submitButton).toBeInTheDocument();
    });

    it('does not show button for menu for multiple links if one is invalid', () => {
      const linksForField = [
        { href: 'http://asdasd.com', title: 'Test Title' } as LinkModel,
        { title: 'Test Title2' } as LinkModel,
      ];

      jest.mock('../utils', () => ({
        getCellLinks: () => linksForField,
      }));

      const field = getFieldWithLinks(linksForField);

      render(
        <AutoCell
          value="test"
          field={field}
          justifyContent="normal"
          rowIdx={0}
          cellOptions={{ type: TableCellDisplayMode.Auto }}
        />
      );
      const submitButton = screen.queryByRole('button');
      expect(submitButton).not.toBeInTheDocument();
    });
  });
});
