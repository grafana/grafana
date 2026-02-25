import { renderHook } from '@testing-library/react';

import { arrayToDataFrame, DataTopic, FieldType, toDataFrame } from '@grafana/data';

import { useAllFieldDisplayNames } from './utils';

const seriesFrame = toDataFrame({
  name: 'A',
  fields: [
    { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
    { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
  ],
});
seriesFrame.fields[1].config.displayName = 'Temperature (F)';

const annoFrame = arrayToDataFrame([
  {
    time: 100,
    timeEnd: 200,
    isRegion: true,
    color: 'rgba(120, 120, 120, 0.1)',
  },
]);

annoFrame.fields[1].config.displayName = 'Annotation timeEnd';
annoFrame.name = 'annotation';
annoFrame.meta = {
  dataTopic: DataTopic.Annotations,
};

describe('useAllFieldDisplayNames', () => {
  it('should return all display names', () => {
    const { result } = renderHook(() => useAllFieldDisplayNames([seriesFrame], [annoFrame]));
    const { display, raw } = result.current;
    expect([...display]).toEqual(['Time', 'Temperature (F)', 'time', 'Annotation timeEnd', 'isRegion', 'color']);
    expect([...raw]).toEqual(['Temp', 'timeEnd']);
  });
});
