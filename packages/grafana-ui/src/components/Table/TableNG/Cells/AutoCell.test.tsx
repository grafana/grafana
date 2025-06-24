import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Field, FieldType, LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
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

    it('shows multiple datalinks in the tooltip', async () => {
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

      const cell = screen.getByTestId(selectors.components.TablePanel.autoCell);
      await userEvent.click(cell);

      const tooltip = screen.getByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper);
      expect(tooltip).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Title2')).toBeInTheDocument();
    });

    it('does not show tooltip for multiple links if one is invalid', async () => {
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

      const cell = screen.getByTestId(selectors.components.TablePanel.autoCell);
      await userEvent.click(cell);

      expect(screen.queryByTestId(selectors.components.DataLinksActionsTooltip.tooltipWrapper)).not.toBeInTheDocument();
    });
  });
});
