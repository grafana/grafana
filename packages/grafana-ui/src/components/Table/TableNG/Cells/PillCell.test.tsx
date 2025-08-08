import { render, RenderResult } from '@testing-library/react';

import { Field, FieldType, MappingType, createTheme } from '@grafana/data';

import { PillCell } from './PillCell';

describe('PillCell', () => {
  const theme = createTheme();

  const fieldWithValues = (values: unknown[]): Field => ({
    name: 'test',
    type: FieldType.string,
    values: values,
    config: {},
  });

  const ser = new XMLSerializer();

  const expectHTML = (result: RenderResult, expected: string) => {
    let actual = ser.serializeToString(result.asFragment()).replace(/xmlns=".*?" /g, '');
    expect(actual).toEqual(expected.replace(/^\s*|\n/gm, ''));
  };

  // one class for lightTextPill, darkTextPill

  describe('Color by hash (classic palette)', () => {
    it('single value', () => {
      expectHTML(
        render(<PillCell field={fieldWithValues(['value1'])} rowIdx={0} theme={theme} />),
        `<span style="background-color: rgb(63, 43, 91); color: rgb(255, 255, 255);">value1</span>`
      );
    });

    it('empty string', () => {
      expectHTML(render(<PillCell field={fieldWithValues([''])} rowIdx={0} theme={theme} />), '');
    });

    it('null', () => {
      const { container } = render(<PillCell field={fieldWithValues([])} rowIdx={0} theme={theme} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('CSV values', () => {
      expectHTML(
        render(<PillCell field={fieldWithValues(['value1,value2,value3'])} rowIdx={0} theme={theme} />),
        `
        <span style="background-color: rgb(63, 43, 91); color: rgb(255, 255, 255);">value1</span>
        <span style="background-color: rgb(252, 226, 222); color: rgb(0, 0, 0);">value2</span>
        <span style="background-color: rgb(81, 149, 206); color: rgb(0, 0, 0);">value3</span>
        `
      );
    });

    it('JSON array values', () => {
      expectHTML(
        render(<PillCell field={fieldWithValues(['["value1","value2","value3"]'])} rowIdx={0} theme={theme} />),
        `
        <span style="background-color: rgb(63, 43, 91); color: rgb(255, 255, 255);">value1</span>
        <span style="background-color: rgb(252, 226, 222); color: rgb(0, 0, 0);">value2</span>
        <span style="background-color: rgb(81, 149, 206); color: rgb(0, 0, 0);">value3</span>
        `
      );
    });
  });

  describe('Color by value mappings', () => {
    it('CSV values', () => {
      const mockField = fieldWithValues(['success,error,warning,unknown']);
      const field = {
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
            value === 'success'
              ? '#00FF00'
              : value === 'error'
                ? '#FF0000'
                : value === 'warning'
                  ? '#FFFF00'
                  : '#FF780A',
          numeric: 0,
        }),
      } satisfies Field;

      expectHTML(
        render(<PillCell field={field} rowIdx={0} theme={theme} />),
        `
        <span style="background-color: rgb(0, 255, 0); color: rgb(0, 0, 0);">success</span>
        <span style="background-color: rgb(255, 0, 0); color: rgb(0, 0, 0);">error</span>
        <span style="background-color: rgb(255, 255, 0); color: rgb(0, 0, 0);">warning</span>
        <span style="background-color: rgb(255, 120, 10); color: rgb(0, 0, 0);">unknown</span>
        `
      );
    });

    // TODO: handle null values?
  });
});
