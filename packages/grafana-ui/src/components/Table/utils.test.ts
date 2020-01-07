import { MutableDataFrame, GrafanaThemeType, FieldType } from '@grafana/data';
import { getColumns } from './utils';
import { getTheme } from '../../themes';

function getData() {
  const data = new MutableDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [] },
      {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: {
          custom: {
            width: 100,
          },
        },
      },
      {
        name: 'Message',
        type: FieldType.string,
        values: [],
        config: {
          custom: {
            align: 'center',
          },
        },
      },
    ],
  });
  return data;
}

describe('Table utils', () => {
  describe('getColumns', () => {
    it('Should build columns from DataFrame', () => {
      const theme = getTheme(GrafanaThemeType.Dark);
      const columns = getColumns(getData(), 1000, theme);

      expect(columns[0].Header).toBe('Time');
      expect(columns[1].Header).toBe('Value');
    });

    it('Should distribute width and use field config width', () => {
      const theme = getTheme(GrafanaThemeType.Dark);
      const columns = getColumns(getData(), 1000, theme);

      expect(columns[0].width).toBe(450);
      expect(columns[1].width).toBe(100);
    });

    it('Should use textAlign from custom', () => {
      const theme = getTheme(GrafanaThemeType.Dark);
      const columns = getColumns(getData(), 1000, theme);

      expect(columns[2].textAlign).toBe('center');
    });

    it('Should set textAlign to right for number values', () => {
      const theme = getTheme(GrafanaThemeType.Dark);
      const columns = getColumns(getData(), 1000, theme);

      expect(columns[1].textAlign).toBe('right');
    });
  });
});
