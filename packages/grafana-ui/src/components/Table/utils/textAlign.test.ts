import { FieldType, toDataFrame } from '@grafana/data';

import { getTextAlign } from './textAlign';

describe('getTextAlign', () => {
  const data = toDataFrame({
    fields: [
      { name: 'Value', type: FieldType.number, values: [] },
      {
        name: 'Message',
        type: FieldType.string,
        values: [],
        config: { custom: { align: 'center' } },
      },
    ],
  });

  it('Should use textAlign from custom', () => {
    const textAlign = getTextAlign(data.fields[2]);
    expect(textAlign).toBe('center');
  });

  it('Should set textAlign to right for number values', () => {
    const textAlign = getTextAlign(data.fields[1]);
    expect(textAlign).toBe('flex-end');
  });
});
