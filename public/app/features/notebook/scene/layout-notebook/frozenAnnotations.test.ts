import { waitFor } from '@testing-library/react';

import { toDataFrame } from '@grafana/data';
import { config, setRunRequest } from '@grafana/runtime';
import { EmbeddedScene, SceneFlexLayout, SceneTimeRange } from '@grafana/scenes';
import { runRequest } from 'app/features/query/state/runRequest';

import { deserializeFrozenAnnotations, freezeAnnotation, serializeFrozenAnnotations } from './frozenAnnotations';

setRunRequest(runRequest);

const deploys = { name: 'Deploys', enable: true, hide: false, iconColor: 'blue' };

// Processed rows, as a panel's data holds them: the layer has already stamped source, colour and type. A
// point has a timeEnd equal to its time, as the annotations API returns it.
const shown = toDataFrame(
  [
    { time: 1700000000000, timeEnd: 1700000000000, text: 'deploy v1' },
    { time: 1700000100000, timeEnd: 1700000200000, text: 'rollout' },
    { time: 1700000300000, timeEnd: 1700000300000, text: 'alert fired', newState: 'alerting' },
  ].map((row) => ({ newState: undefined, ...row, source: deploys, color: '#000', type: 'Deploys', isRegion: false }))
);

describe('frozen annotations', () => {
  it('replays the stored events the way a live layer emits them', async () => {
    const layers = deserializeFrozenAnnotations([freezeAnnotation(deploys, [shown])])!;
    // The layer reads its time range from an ancestor, as it does from the notebook.
    const scene = new EmbeddedScene({
      $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
      $data: layers,
      body: new SceneFlexLayout({ children: [] }),
    });
    const [layer] = layers.state.layers;
    const deactivate = scene.activate();
    const deactivateLayer = layer.activate();

    await waitFor(() => expect(layer.state.data?.series).toHaveLength(1));

    const frame = layer.state.data?.series[0];
    const values = (name: string) => frame?.fields.find((field) => field.name === name)?.values;
    expect(frame?.meta?.dataTopic).toBe('annotations');
    expect(values('text')).toEqual(['deploy v1', 'rollout', 'alert fired']);
    expect(values('isRegion')).toEqual([false, true, false]);
    expect(values('color')).toEqual([
      config.theme2.visualization.getColorByName('blue'),
      config.theme2.visualization.getColorByName('blue'),
      'red',
    ]);

    deactivateLayer();
    deactivate();
  });

  it('saves what it loaded', () => {
    const annotations = [freezeAnnotation(deploys, [shown])];

    expect(serializeFrozenAnnotations(deserializeFrozenAnnotations(annotations))).toEqual(annotations);
  });
});
