import { render, RenderResult } from '@testing-library/react';

import { DataFrame, Field, FieldType, GrafanaTheme2, MappingType, createTheme } from '@grafana/data';
import { TableCellDisplayMode, TablePillCellOptions } from '@grafana/schema';

import { mockThemeContext } from '../../../../themes/ThemeContext';

import { PillCell, getStyles } from './PillCell';

describe('PillCell', () => {
  let pillClass: string;
  let restoreThemeContext: () => void;

  beforeEach(() => {
    pillClass = getStyles(createTheme()).pill;
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterEach(() => {
    restoreThemeContext();
  });

  const mockCellOptions: TablePillCellOptions = {
    type: TableCellDisplayMode.Pill,
  };

  const mockField: Field = {
    name: 'test',
    type: FieldType.string,
    values: [],
    config: {},
  };

  const mockFrame: DataFrame = {
    name: 'test',
    fields: [mockField],
    length: 1,
  };

  const defaultProps = {
    field: mockField,
    justifyContent: 'flex-start' as const,
    cellOptions: mockCellOptions,
    rowIdx: 0,
    frame: mockFrame,
    height: 30,
    width: 100,
    theme: {} as GrafanaTheme2,
    cellInspect: false,
    showFilters: false,
  };

  const ser = new XMLSerializer();

  const expectHTML = (result: RenderResult, expected: string) => {
    let actual = ser.serializeToString(result.asFragment()).replace(/xmlns=".*?" /g, '');
    expect(actual).toEqual(expected.replace(/^\s*|\n/gm, ''));
  };

  // one class for lightTextPill, darkTextPill

  describe('Color by hash (classic palette)', () => {
    const props = { ...defaultProps };

    it('single value', () => {
      expectHTML(
        render(<PillCell {...props} value="value1" />),
        `<span class="${pillClass}" style="background-color: rgb(63, 43, 91); color: rgb(255, 255, 255);">value1</span>`
      );
    });

    it('empty string', () => {
      expectHTML(render(<PillCell {...props} value="" />), '');
    });

    // it('null', () => {
    //   expectHTML(
    //     render(<PillCell {...props} value={null} />),
    //     '<span class="${pillClass}" style="background-color: rgb(63, 43, 91); color: rgb(255, 255, 255);">value1</span>'
    //   );
    // });

    it('CSV values', () => {
      expectHTML(
        render(<PillCell {...props} value="value1,value2,value3" />),
        `
        <span class="${pillClass}" style="background-color: rgb(63, 43, 91); color: rgb(255, 255, 255);">value1</span>
        <span class="${pillClass}" style="background-color: rgb(252, 226, 222); color: rgb(0, 0, 0);">value2</span>
        <span class="${pillClass}" style="background-color: rgb(81, 149, 206); color: rgb(0, 0, 0);">value3</span>
        `
      );
    });

    it('JSON array values', () => {
      expectHTML(
        render(<PillCell {...props} value='["value1","value2","value3"]' />),
        `
        <span class="${pillClass}" style="background-color: rgb(63, 43, 91); color: rgb(255, 255, 255);">value1</span>
        <span class="${pillClass}" style="background-color: rgb(252, 226, 222); color: rgb(0, 0, 0);">value2</span>
        <span class="${pillClass}" style="background-color: rgb(81, 149, 206); color: rgb(0, 0, 0);">value3</span>
        `
      );
    });

    // TODO: handle null values?
  });

  describe('Color by value mappings', () => {
    const field: Field = {
      ...mockField,
      config: {
        ...mockField.config,
        mappings: [
          {
            type: MappingType.ValueToText,
            options: {
              success: { color: '#00FF00' },
              error: { color: '#FF0000' },
              warning: { color: '#FFFF00' },
            },
          },
        ],
      },
      display: (value: unknown) => ({
        text: String(value),
        color:
          value === 'success' ? '#00FF00' : value === 'error' ? '#FF0000' : value === 'warning' ? '#FFFF00' : '#FF780A',
        numeric: 0,
      }),
    };

    const props = {
      ...defaultProps,
      field,
    };

    it('CSV values', () => {
      expectHTML(
        render(<PillCell {...props} value="success,error,warning,unknown" />),
        `
        <span class="${pillClass}" style="background-color: rgb(0, 255, 0); color: rgb(0, 0, 0);">success</span>
        <span class="${pillClass}" style="background-color: rgb(255, 0, 0); color: rgb(0, 0, 0);">error</span>
        <span class="${pillClass}" style="background-color: rgb(255, 255, 0); color: rgb(0, 0, 0);">warning</span>
        <span class="${pillClass}" style="background-color: rgb(255, 120, 10); color: rgb(0, 0, 0);">unknown</span>
        `
      );
    });

    // TODO: handle null values?
  });
});
