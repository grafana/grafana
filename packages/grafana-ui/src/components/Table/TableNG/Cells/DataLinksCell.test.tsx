import { render, screen } from '@testing-library/react';

import { createTheme, type Field, FieldType, type LinkModel } from '@grafana/data';

import { TableCellDisplayMode } from '../../types';

import { DataLinksCell, getStyles } from './DataLinksCell';

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

    it('removes the right border from the final link when cell actions follow the links', () => {
      const linksForField = [
        { href: 'http://asdasd.com', title: 'Test Title' } as LinkModel,
        { href: 'http://asdasd2.com', title: 'Test Title2' } as LinkModel,
      ];
      const field = getFieldWithLinks(linksForField);
      const cellClass = getStyles(createTheme(), {
        textWrap: false,
        textAlign: 'left',
        shouldOverflow: false,
        hoverOverflow: false,
      });

      render(
        <div className={cellClass}>
          <DataLinksCell field={field} rowIdx={0} />
          <div data-testid="cell-actions" />
        </div>
      );

      const links = screen.getAllByRole('link');
      const cellRules = Array.from(document.styleSheets)
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .filter(
          (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText.includes(`.${cellClass}`)
        );
      const borderRule = cellRules.find((rule) => rule.style.getPropertyValue('border-right').startsWith('2px solid'));
      const finalLinkRule = cellRules.find((rule) => rule.style.getPropertyValue('border-right') === 'none');

      expect(borderRule).toBeDefined();
      expect(finalLinkRule).toBeDefined();
      expect(links.every((link) => link.matches(borderRule!.selectorText))).toBe(true);
      expect(links[0].matches(finalLinkRule!.selectorText)).toBe(false);
      expect(links[1].matches(finalLinkRule!.selectorText)).toBe(true);
    });
  });
});
