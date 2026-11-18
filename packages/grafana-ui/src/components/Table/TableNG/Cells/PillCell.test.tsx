import { render, screen, type RenderResult } from '@testing-library/react';

import {
  type Field,
  type GrafanaTheme2,
  FieldColorModeId,
  FieldType,
  MappingType,
  ThemeContext,
  createTheme,
  fieldColorModeRegistry,
  getColorByStringHash,
} from '@grafana/data';
import { ThresholdsMode } from '@grafana/schema';

import { getTextColorForBackground } from '../../../../utils/colors';
import { getTagColorVariables, getTagColorsFromName, getTransparentOutlineColor } from '../../../../utils/tags';

import { PillCell } from './PillCell';

// Refreshed pills are Tags, which take their colors from inline custom properties.
const expectTagColors = (element: HTMLElement, background: string, text: string) => {
  expect(element.style.getPropertyValue('--tag-background')).toBe(background);
  expect(element.style.getPropertyValue('--tag-text')).toBe(text);
};

const expectBaseColor = (element: HTMLElement, baseColor: string, theme?: GrafanaTheme2) => {
  const variables = getTagColorVariables(baseColor, theme);
  expectTagColors(element, variables['--tag-background'], variables['--tag-text']);
};

describe('PillCell', () => {
  const theme = createTheme();

  const fieldWithValues = (values: unknown[]): Field => ({
    name: 'test',
    type: FieldType.string,
    values: values,
    config: {},
    display: (value: unknown) => ({ text: String(value), color: '#FF780A', numeric: NaN }),
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
        render(
          <PillCell
            getTextColorForBackground={getTextColorForBackground}
            field={fieldWithValues(['value1'])}
            rowIdx={0}
            theme={theme}
          />
        ),
        `<span style="background-color: rgb(63, 43, 91); color: rgb(247, 248, 250);">value1</span>`
      );
    });

    it.each([
      ['classic palette', FieldColorModeId.PaletteClassic, 'rgb(222, 218, 247)', 'rgb(32, 34, 38)'],
      [
        'classic palette by series name',
        FieldColorModeId.PaletteClassicByName,
        'rgb(98, 158, 81)',
        'rgb(247, 248, 250)',
      ],
      ['thresholds', FieldColorModeId.Thresholds, 'rgb(63, 43, 91)', 'rgb(247, 248, 250)'],
    ])('preserves legacy colors for %s', (_, colorMode, backgroundColor, color) => {
      const mockField = fieldWithValues(['value1']);
      const field = {
        ...mockField,
        config: { ...mockField.config, color: { mode: colorMode } },
      } satisfies Field;

      render(<PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />);

      expect(screen.getByText('value1')).toHaveStyle({ backgroundColor, color });
    });

    it('empty string', () => {
      expectHTML(
        render(
          <PillCell
            getTextColorForBackground={getTextColorForBackground}
            field={fieldWithValues([''])}
            rowIdx={0}
            theme={theme}
          />
        ),
        ''
      );
    });

    it('null', () => {
      const { container } = render(
        <PillCell
          getTextColorForBackground={getTextColorForBackground}
          field={fieldWithValues([])}
          rowIdx={0}
          theme={theme}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('CSV values', () => {
      expectHTML(
        render(
          <PillCell
            getTextColorForBackground={getTextColorForBackground}
            field={fieldWithValues(['value1,value2,value3'])}
            rowIdx={0}
            theme={theme}
          />
        ),
        `
        <span style="background-color: rgb(63, 43, 91); color: rgb(247, 248, 250);">value1</span>
        <span style="background-color: rgb(252, 226, 222); color: rgb(32, 34, 38);">value2</span>
        <span style="background-color: rgb(81, 149, 206); color: rgb(247, 248, 250);">value3</span>
        `
      );
    });

    it('JSON array values', () => {
      expectHTML(
        render(
          <PillCell
            getTextColorForBackground={getTextColorForBackground}
            field={fieldWithValues(['["value1","value2","value3"]'])}
            rowIdx={0}
            theme={theme}
          />
        ),
        `
        <span style="background-color: rgb(63, 43, 91); color: rgb(247, 248, 250);">value1</span>
        <span style="background-color: rgb(252, 226, 222); color: rgb(32, 34, 38);">value2</span>
        <span style="background-color: rgb(81, 149, 206); color: rgb(247, 248, 250);">value3</span>
        `
      );
    });

    it('FieldType.other with array', () => {
      const field = fieldWithValues([['value1', 'value2', 'value3']]);
      field.type = FieldType.other;
      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(63, 43, 91); color: rgb(247, 248, 250);">value1</span>
        <span style="background-color: rgb(252, 226, 222); color: rgb(32, 34, 38);">value2</span>
        <span style="background-color: rgb(81, 149, 206); color: rgb(247, 248, 250);">value3</span>
        `
      );
    });

    it('FieldType.other with array with some null values', () => {
      const field = fieldWithValues([['value1', null, 'value2', undefined, 'value3']]);
      field.type = FieldType.other;
      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(63, 43, 91); color: rgb(247, 248, 250);">value1</span>
        <span style="background-color: rgb(252, 226, 222); color: rgb(32, 34, 38);">value2</span>
        <span style="background-color: rgb(81, 149, 206); color: rgb(247, 248, 250);">value3</span>
        `
      );
    });

    it('FieldType.other with non-array', () => {
      const field = fieldWithValues([{ value1: true, value2: false, value3: 42 }]);
      field.type = FieldType.other;
      expectHTML(
        render(
          <PillCell
            getTextColorForBackground={getTextColorForBackground}
            field={fieldWithValues([])}
            rowIdx={0}
            theme={theme}
          />
        ),
        ''
      );
    });

    it('non-string values', () => {
      expectHTML(
        render(
          <PillCell
            getTextColorForBackground={getTextColorForBackground}
            field={fieldWithValues(['[100,200,300]'])}
            rowIdx={0}
            theme={theme}
          />
        ),
        `
        <span style="background-color: rgb(252, 226, 222); color: rgb(32, 34, 38);">100</span>
        <span style="background-color: rgb(222, 218, 247); color: rgb(32, 34, 38);">200</span>
        <span style="background-color: rgb(249, 217, 249); color: rgb(32, 34, 38);">300</span>
        `
      );
    });

    it('custom display text', () => {
      const mockField = fieldWithValues(['value1,value2,value3']);
      const field = {
        ...mockField,
        display: (value: unknown) => ({
          text: `${value} lbs`,
          color: '#FF780A',
          numeric: 0,
        }),
      } satisfies Field;

      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style=\"background-color: rgb(207, 250, 255); color: rgb(32, 34, 38);\">value1 lbs</span>
        <span style=\"background-color: rgb(229, 172, 14); color: rgb(247, 248, 250);\">value2 lbs</span>
        <span style=\"background-color: rgb(63, 104, 51); color: rgb(247, 248, 250);\">value3 lbs</span>
        `
      );
    });
  });

  describe('Visual refresh', () => {
    it.each(['dark', 'light'] as const)('renders mapped pills with contrasting colors in %s mode', (mode) => {
      const theme = createTheme({ colors: { mode } });
      theme.flags.visualDesignRefresh = true;
      const field = fieldWithValues(['error']);
      field.config.mappings = [{ type: MappingType.ValueToText, options: { error: { color: '#ff0000' } } }];
      field.display = () => ({ text: 'error', color: '#ff0000', numeric: 0 });

      render(
        <ThemeContext.Provider value={theme}>
          <PillCell field={field} rowIdx={0} theme={theme} getTextColorForBackground={getTextColorForBackground} />
        </ThemeContext.Provider>
      );
      expectBaseColor(screen.getByText('error'), '#ff0000', theme);
    });

    // Tag reads the theme off context, so the flag has to be on the provided theme too — in the
    // table the prop and the context theme are the same object.
    const refreshTheme = createTheme();
    refreshTheme.flags.visualDesignRefresh = true;

    const renderRefreshed = (field: Field) =>
      render(
        <ThemeContext.Provider value={refreshTheme}>
          <PillCell
            getTextColorForBackground={getTextColorForBackground}
            field={field}
            rowIdx={0}
            theme={refreshTheme}
          />
        </ThemeContext.Provider>
      );

    it('renders pills with the refreshed Tag styling and colors', () => {
      renderRefreshed(fieldWithValues(['value1,value2']));
      for (const text of ['value1', 'value2']) {
        const pill = screen.getByText(text);
        const { background, text: textColor } = getTagColorsFromName(text, refreshTheme);
        expectTagColors(pill, background, textColor);
        expect(pill).toHaveStyle({ borderRadius: refreshTheme.shape.radius.pill });
      }
    });

    it('uses tag colors when the field has the default thresholds color mode', () => {
      const mockField = fieldWithValues(['value1']);
      const field = {
        ...mockField,
        config: { ...mockField.config, color: { mode: FieldColorModeId.Thresholds } },
      } satisfies Field;

      // Thresholds is the default mode, but it has no categorical palette for coloring pills.
      const { background, text } = getTagColorsFromName('value1', refreshTheme);
      renderRefreshed(field);
      expectTagColors(screen.getByText('value1'), background, text);
    });

    it('keeps a fixed field color as the background and derives contrasting text', () => {
      const mockField = fieldWithValues(['value1']);
      const fixed = {
        ...mockField,
        config: { ...mockField.config, color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' } },
      } satisfies Field;

      renderRefreshed(fixed);
      expectBaseColor(screen.getByText('value1'), refreshTheme.visualization.getColorByName('red'), refreshTheme);
    });

    it('outlines transparent mapped pills', () => {
      const field = fieldWithValues(['none']);
      field.config.mappings = [{ type: MappingType.ValueToText, options: { none: { color: 'transparent' } } }];
      field.display = () => ({ text: 'none', color: 'rgba(255, 255, 255, 0)', numeric: 0 });

      renderRefreshed(field);
      const pill = screen.getByText('none');
      const transparent = refreshTheme.visualization.getColorByName('transparent');
      expectBaseColor(pill, transparent, refreshTheme);
      expect(pill).toHaveStyle({
        boxShadow: `inset 0 0 0 1px ${getTransparentOutlineColor(transparent, refreshTheme.colors.border.strong)}`,
      });
    });

    it.each([
      ['classic palette', FieldColorModeId.PaletteClassic, 'value1'],
      ['classic palette by series name', FieldColorModeId.PaletteClassicByName, 'test'],
    ])('uses theme tag colors for the %s', (_, colorMode, colorName) => {
      const mockField = fieldWithValues(['value1']);
      const classic = {
        ...mockField,
        config: { ...mockField.config, color: { mode: colorMode } },
      } satisfies Field;

      renderRefreshed(classic);
      const { background, text } = getTagColorsFromName(colorName, refreshTheme);
      expectTagColors(screen.getByText('value1'), background, text);
    });

    it('honours other categorical field palettes over the tag colors', () => {
      const mockField = fieldWithValues(['value1']);
      const colorblind = {
        ...mockField,
        config: { ...mockField.config, color: { mode: FieldColorModeId.PaletteColorblind } },
      } satisfies Field;

      renderRefreshed(colorblind);
      const palette = fieldColorModeRegistry.get(FieldColorModeId.PaletteColorblind).getColors!(refreshTheme);
      expectBaseColor(screen.getByText('value1'), getColorByStringHash(palette, 'value1'), refreshTheme);
    });

    it('assigns stable shades of the configured color to pill labels', () => {
      const field = fieldWithValues(['alpha,beta,gamma']);
      field.config.color = { mode: FieldColorModeId.Shades, fixedColor: '#ff0000' };

      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(225, 0, 6); color: rgb(247, 248, 250);">alpha</span>
        <span style="background-color: rgb(255, 22, 15); color: rgb(247, 248, 250);">beta</span>
        <span style="background-color: rgb(225, 0, 6); color: rgb(247, 248, 250);">gamma</span>
        `
      );
    });

    it('uses the numeric pill range for a continuous scale', () => {
      const field = fieldWithValues(['10,20,30']);
      field.config.color = { mode: FieldColorModeId.ContinuousBlues };

      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(24, 27, 31); color: rgb(247, 248, 250);">10</span>
        <span style="background-color: rgb(28, 62, 114); color: rgb(247, 248, 250);">20</span>
        <span style="background-color: rgb(31, 96, 196); color: rgb(247, 248, 250);">30</span>
        `
      );
    });

    it('uses the numeric pill range for percentage thresholds', () => {
      const field = fieldWithValues(['10,20,30']);
      field.config.color = { mode: FieldColorModeId.Thresholds };
      field.config.thresholds = {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'red' },
        ],
      };

      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(115, 191, 105); color: rgb(247, 248, 250);">10</span>
        <span style="background-color: rgb(242, 73, 92); color: rgb(247, 248, 250);">20</span>
        <span style="background-color: rgb(242, 73, 92); color: rgb(247, 248, 250);">30</span>
        `
      );
    });

    it('applies thresholds to numeric pills when value mappings are not configured', () => {
      const field = fieldWithValues(['0,50,100']);
      field.config.color = { mode: FieldColorModeId.Thresholds };
      field.config.thresholds = {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'red' },
        ],
      };

      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(115, 191, 105); color: rgb(247, 248, 250);">0</span>
        <span style="background-color: rgb(242, 73, 92); color: rgb(247, 248, 250);">50</span>
        <span style="background-color: rgb(242, 73, 92); color: rgb(247, 248, 250);">100</span>
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
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(0, 255, 0); color: rgb(247, 248, 250);">success</span>
        <span style="background-color: rgb(255, 0, 0); color: rgb(247, 248, 250);">error</span>
        <span style="background-color: rgb(255, 255, 0); color: rgb(32, 34, 38);">warning</span>
        <span style="background-color: rgb(5, 43, 81); color: rgb(247, 248, 250);">unknown</span>
        `
      );
    });

    it('uses the selected color scheme when a matching value mapping only changes text', () => {
      const field = fieldWithValues(['success,error']);
      field.config = {
        color: { mode: FieldColorModeId.PaletteClassic },
        mappings: [
          {
            type: MappingType.ValueToText,
            options: {
              success: { text: 'OK' },
              error: { text: 'Bad' },
            },
          },
        ],
      };
      field.display = (value: unknown) => ({ text: value === 'success' ? 'OK' : 'Bad', color: '#ff780a', numeric: 0 });

      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(229, 172, 14); color: rgb(247, 248, 250);">OK</span>
        <span style="background-color: rgb(87, 148, 242); color: rgb(247, 248, 250);">Bad</span>
        `
      );
    });

    it('uses explicit mapping colors instead of the selected color scheme', () => {
      const mockField = fieldWithValues(['success,error']);
      const mapped: Record<string, { text: string; color: string }> = {
        success: { text: 'OK', color: '#00FF00' },
        error: { text: 'Bad', color: '#FF0000' },
      };
      const field = {
        ...mockField,
        config: {
          ...mockField.config,
          color: { mode: FieldColorModeId.Shades, fixedColor: '#0000ff' },
          mappings: [{ type: MappingType.ValueToText, options: mapped }],
        },
        display: (value: unknown) => ({
          ...(mapped[String(value)] ?? { text: String(value), color: '#FF780A' }),
          numeric: 0,
        }),
      } satisfies Field;

      expectHTML(
        render(
          <PillCell getTextColorForBackground={getTextColorForBackground} field={field} rowIdx={0} theme={theme} />
        ),
        `
        <span style="background-color: rgb(0, 255, 0); color: rgb(247, 248, 250);">OK</span>
        <span style="background-color: rgb(255, 0, 0); color: rgb(247, 248, 250);">Bad</span>
        `
      );
    });

    // TODO: handle null values?
  });
});
