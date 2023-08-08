import { FieldType, MutableDataFrame } from '@grafana/data';

export function getMockDataFrame() {
  const frame = new MutableDataFrame({
    refId: 'A',
    fields: [
      { name: 'Time', type: FieldType.time },
      { name: 'Value', type: FieldType.number },
      { name: 'Label', type: FieldType.string },
    ],
    meta: {
      preferredVisualisationType: 'graph',
    },
  });

  for (let i = 0; i < 500; i++) {
    frame.add({
      Time: Date.now() + Math.random() * i * 100000 * (Math.random() > 0.5 ? 1 : -1),
      Value: Math.random() * i * 100,
      Label: 'A',
    });
  }

  return frame;
}
