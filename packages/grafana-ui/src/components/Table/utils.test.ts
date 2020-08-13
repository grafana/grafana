import { MutableDataFrame, FieldType } from '@grafana/data';
import { getColumns, getTextAlign } from './utils';

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
      const columns = getColumns(getData(), 1000, 120);

      expect(columns[0].Header).toBe('Time');
      expect(columns[1].Header).toBe('Value');
    });

    it('Should distribute width and use field config width', () => {
      const columns = getColumns(getData(), 1000, 120);

      expect(columns[0].width).toBe(450);
      expect(columns[1].width).toBe(100);
    });

    it('Should be possible to use a custom renderer for a cell', () => {
      const CustomRender = jest.fn();
      const data = new MutableDataFrame({
        fields: [
          {
            name: 'Value',
            type: FieldType.number,
            values: [],
            config: {
              custom: {
                width: 100,
                render: CustomRender,
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
      const columns = getColumns(data, 1000, 120);

      expect(columns[0].Cell).toEqual(CustomRender);
      expect(columns[1].Cell).not.toEqual(CustomRender);
    });
  });

  describe('getTextAlign', () => {
    it('Should use textAlign from custom', () => {
      const data = getData();
      const textAlign = getTextAlign(data.fields[2]);

      expect(textAlign).toBe('center');
    });

    it('Should set textAlign to right for number values', () => {
      const data = getData();
      const textAlign = getTextAlign(data.fields[1]);
      expect(textAlign).toBe('right');
    });
  });
});
