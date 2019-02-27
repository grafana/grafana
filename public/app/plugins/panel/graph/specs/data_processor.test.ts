import { DataProcessor } from '../data_processor';

describe('Graph DataProcessor', () => {
  const panel: any = {
    xaxis: {},
  };

  const processor = new DataProcessor(panel);

  describe('Given default xaxis options and query that returns docs', () => {
    beforeEach(() => {
      panel.xaxis.mode = 'time';
      panel.xaxis.name = 'hostname';
      panel.xaxis.values = [];

      processor.getSeriesList({
        dataList: [
          {
            type: 'docs',
            datapoints: [{ hostname: 'server1', avg: 10 }],
          },
        ],
      });
    });

    it('Should automatically set xaxis mode to field', () => {
      expect(panel.xaxis.mode).toBe('field');
    });
  });

  describe('getDataFieldNames(', () => {
    const dataList = [
      {
        type: 'docs',
        datapoints: [
          {
            hostname: 'server1',
            valueField: 11,
            nested: {
              prop1: 'server2',
              value2: 23,
            },
          },
        ],
      },
    ];

    it('Should return all field names', () => {
      const fields = processor.getDataFieldNames(dataList, false);
      expect(fields).toContain('hostname');
      expect(fields).toContain('valueField');
      expect(fields).toContain('nested.prop1');
      expect(fields).toContain('nested.value2');
    });

    it('Should return all number fields', () => {
      const fields = processor.getDataFieldNames(dataList, true);
      expect(fields).toContain('valueField');
      expect(fields).toContain('nested.value2');
    });
  });
});
