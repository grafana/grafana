import { lastValueFrom } from 'rxjs';

import { toDataFrame } from '../dataframe/processDataFrame';
import { LoadingState } from '../types/data';
import { FieldType } from '../types/dataFrame';
import { type PanelData } from '../types/panel';
import { DataTopic } from '../types/query';
import { type DataTransformerConfig } from '../types/transformations';

import { standardTransformersRegistry, type TransformerRegistryItem } from './standardTransformersRegistry';
import { transformPanelData } from './transformPanelData';
import { limitTransformer } from './transformers/limit';
import { organizeFieldsTransformer } from './transformers/organize';

beforeAll(() => {
  standardTransformersRegistry.setInit(
    () =>
      [
        {
          id: organizeFieldsTransformer.id,
          name: organizeFieldsTransformer.name,
          transformation: () => Promise.resolve(organizeFieldsTransformer),
          editor: () => null,
        },
        {
          id: limitTransformer.id,
          name: limitTransformer.name,
          transformation: () => Promise.resolve(limitTransformer),
          editor: () => null,
        },
      ] as unknown as TransformerRegistryItem[]
  );
});

function panelData(overrides: Partial<PanelData> = {}): PanelData {
  return {
    state: LoadingState.Done,
    series: [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'keep', type: FieldType.number, values: [1, 2, 3] },
          { name: 'drop', type: FieldType.number, values: [4, 5, 6] },
        ],
      }),
    ],
    timeRange: { from: {}, to: {}, raw: { from: 'now-6h', to: 'now' } } as PanelData['timeRange'],
    ...overrides,
  };
}

describe('transformPanelData', () => {
  it('applies series transformations to series frames', async () => {
    const configs: DataTransformerConfig[] = [{ id: 'organize', options: { excludeByName: { drop: true } } }];

    const result = await lastValueFrom(transformPanelData(configs, panelData()));

    expect(result.series[0].fields.map((f) => f.name)).toEqual(['keep']);
  });

  it('preserves the rest of the PanelData', async () => {
    const input = panelData({ state: LoadingState.Streaming });

    const result = await lastValueFrom(transformPanelData([{ id: 'organize', options: {} }], input));

    expect(result.state).toBe(LoadingState.Streaming);
    expect(result.timeRange).toBe(input.timeRange);
  });

  // Real annotation frames carry meta.dataTopic (the annotations data layer sets it) and output is
  // bucketed by that, exactly as the host pipeline does.
  function annotationFrame(values: string[]) {
    return toDataFrame({
      meta: { dataTopic: DataTopic.Annotations },
      fields: [{ name: 'text', type: FieldType.string, values }],
    });
  }

  it('routes annotation-topic transformations to annotations only', async () => {
    const input = panelData({ annotations: [annotationFrame(['a', 'b', 'c'])] });
    const configs: DataTransformerConfig[] = [
      { id: 'limit', options: { limitField: 1 }, topic: DataTopic.Annotations },
    ];

    const result = await lastValueFrom(transformPanelData(configs, input));

    expect(result.annotations?.[0].length).toBe(1);
    // Series untouched.
    expect(result.series[0].length).toBe(3);
  });

  it('treats a config with no topic as a series transformation', async () => {
    const input = panelData({ annotations: [annotationFrame(['a', 'b'])] });

    const result = await lastValueFrom(transformPanelData([{ id: 'limit', options: { limitField: 1 } }], input));

    expect(result.series[0].length).toBe(1);
    expect(result.annotations?.[0].length).toBe(2);
  });

  it('drops alertStates-topic transformations rather than running them against series', async () => {
    const configs: DataTransformerConfig[] = [
      { id: 'organize', options: { excludeByName: { drop: true } }, topic: DataTopic.AlertStates },
    ];

    const result = await lastValueFrom(transformPanelData(configs, panelData()));

    expect(result.series[0].fields.map((f) => f.name)).toEqual(['keep', 'drop']);
  });

  it('buckets output frames by dataTopic, so a transformation can move frames between topics', async () => {
    const input = panelData({
      series: [
        toDataFrame({
          refId: 'A',
          meta: { dataTopic: DataTopic.Annotations },
          fields: [{ name: 'text', type: FieldType.string, values: ['a'] }],
        }),
      ],
    });

    const result = await lastValueFrom(transformPanelData([{ id: 'organize', options: {} }], input));

    expect(result.series).toHaveLength(0);
    expect(result.annotations).toHaveLength(1);
  });

  it('leaves annotations undefined when the input had none', async () => {
    const result = await lastValueFrom(transformPanelData([{ id: 'organize', options: {} }], panelData()));

    expect(result.annotations).toBeUndefined();
  });

  it('skips disabled transformations', async () => {
    const configs: DataTransformerConfig[] = [
      { id: 'organize', options: { excludeByName: { drop: true } }, disabled: true },
    ];

    const result = await lastValueFrom(transformPanelData(configs, panelData()));

    expect(result.series[0].fields.map((f) => f.name)).toEqual(['keep', 'drop']);
  });
});
