import { FieldType, SeriesData } from '../types/data';
import { DateTime } from './moment_wrapper';
import { FacadeDefinition, getSeriesDataFacade } from './seriesDataFacade';

interface MySpecialObject {
  time: DateTime;
  name: string;
  value: number;
}

const objectFacadDef: FacadeDefinition<MySpecialObject> = {
  fields: [
    { name: 'time', type: FieldType.time },
    { name: 'name', type: FieldType.string },
    { name: 'value', type: FieldType.number },
  ],
};

describe('seriesDataFacade', () => {
  it('converts series to somethign like an object', () => {
    const series: SeriesData = {
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'name', type: FieldType.string },
        { name: 'value', type: FieldType.number },
        { name: 'aaa', type: FieldType.string },
        { name: 'bbb', type: FieldType.other },
      ],
      rows: [[1, 'First', 1.23, 'A', { b: 1 }], [2, 'Second', 2.34, 'B', { b: 2 }], [3, 'Third', 3.45, 'C', { b: 3 }]],
    };

    const iter = getSeriesDataFacade(series, objectFacadDef);
    const names: string[] = [];
    while (iter.hasNext()) {
      const v = iter.next();
      names.push(v.name);
    }
    expect(names).toEqual(['First', 'Second', 'Third']);
  });
});
