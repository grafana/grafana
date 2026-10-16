import { createDataFrame, FieldType, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { type CustomTransformOperator, SceneDataNode, SceneDataTransformer } from '@grafana/scenes';

import { createSavedPanelTransformations } from './SavedPanelTransformations';

it('exposes source rows and updates saved configs without dropping custom operators', () => {
  const frame = createDataFrame({
    refId: 'A',
    fields: [{ name: 'Value', type: FieldType.number, values: [1] }],
  });
  const source = new SceneDataNode({
    data: { state: LoadingState.Done, series: [frame], timeRange: getDefaultTimeRange() },
  });
  const custom: CustomTransformOperator = () => (input) => input;
  const transformer = new SceneDataTransformer({
    $data: source,
    transformations: [custom, { id: 'organize', options: { excludeByName: { Value: true } } }],
  });
  const api = createSavedPanelTransformations(transformer);
  const changed = jest.fn();
  const unsubscribe = api.subscribe('grafana:table-view', changed);

  expect(api.getSourceSeries('grafana:table-view')).toEqual([frame]);
  expect(api.get('grafana:table-view')).toEqual([{ id: 'organize', options: { excludeByName: { Value: true } } }]);
  expect(api.get('grafana:table-view')).toBe(api.get('grafana:table-view'));

  api.set('grafana:table-view', [{ id: 'limit', options: { limitField: 2 } }]);

  expect(transformer.state.transformations).toEqual([custom, { id: 'limit', options: { limitField: 2 } }]);
  expect(changed).toHaveBeenCalledTimes(1);
  unsubscribe();
});
