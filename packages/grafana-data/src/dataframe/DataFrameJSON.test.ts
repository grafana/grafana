import { FieldType } from '../types/dataFrame';
import { DataFrameJSON, dataFrameFromJSON } from './DataFrameJSON';

describe('DataFrame JSON', () => {
  describe('when called with a DataFrame', () => {
    it('then it should reverse the order of values in all fields', () => {
      const json: DataFrameJSON = {
        schema: {
          fields: [
            { name: 'time', type: FieldType.time },
            { name: 'name', type: FieldType.string },
            { name: 'value', type: FieldType.number },
          ],
        },
        data: {
          values: [
            [100, 200, 300],
            ['a', 'b', 'c'],
            [1, 2, 3],
          ],
          entities: [
            null, // nothing to replace, but keeps the index
            { NaN: [0], Inf: [1], Undef: [2] },
            { NegInf: [2] },
          ],
        },
      };

      const frame = dataFrameFromJSON(json);
      expect(frame).toMatchInlineSnapshot();
    });
  });
});
