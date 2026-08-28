import {
  type CustomTransformOperator,
  type DataFrame,
  LoadingState,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { SceneDataNode, SceneDataTransformer } from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';

import { NO_SYSTEM_TRANSFORMATIONS, getResolvedSystemTransformations } from './systemTransformations';

const passthrough: CustomTransformOperator = () => (source) => source;
const reduce = { id: 'reduce', options: {} };
const series = [toDataFrame([[1, 10]])];

function buildTransformer(sourceSeries: DataFrame[] = series) {
  const source = new SceneDataNode({
    data: { state: LoadingState.Done, series: sourceSeries, timeRange: getDefaultTimeRange() },
  });

  return { source, transformer: new SceneDataTransformer({ $data: source, transformations: [] }) };
}

describe('getResolvedSystemTransformations', () => {
  it('returns the shared empty result when nothing resolves for the current frames', () => {
    const { transformer } = buildTransformer();

    transformer.setSystemTransformations({ supplier: () => ({}) });

    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);
  });

  it('unwraps a custom operator back to the function the plugin registered', () => {
    const { transformer } = buildTransformer();

    transformer.setSystemTransformations({ supplier: () => ({ prepend: [passthrough], append: [reduce] }) });

    const { prepend, append } = getResolvedSystemTransformations(transformer);

    // Scenes normalizes a bare operator into `{ operator, topic }` so it can tag it; readers feed
    // these to `transformDataFrame`, which takes the function
    expect(prepend).toEqual([passthrough]);
    expect(append).toEqual([{ ...reduce, origin: 'plugin', position: 'append' }]);
  });

  it('keeps a stable identity across calls while the frames are unchanged', () => {
    const { transformer } = buildTransformer();

    transformer.setSystemTransformations({ supplier: () => ({ prepend: [passthrough] }) });

    // Editor rows use these arrays as effect deps, so a fresh identity per render replays them all
    expect(getResolvedSystemTransformations(transformer)).toBe(getResolvedSystemTransformations(transformer));
  });

  it('keeps a stable identity before the first query result', () => {
    const { transformer } = buildTransformer([]);
    const supplier = jest.fn().mockReturnValue({});

    transformer.setSystemTransformations({ supplier });

    // Resolving against no frames must not churn either: scenes stands in a shared array for the
    // missing series, so the memo still hits
    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);
    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);
    expect(supplier).toHaveBeenCalledTimes(1);
  });

  it('resolves again for a new frame set', () => {
    const { source, transformer } = buildTransformer();

    transformer.setSystemTransformations({
      supplier: ({ series: frames }) => (frames[0].fields.length > 2 ? { prepend: [reduce] } : {}),
    });

    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);

    source.setState({ data: { ...source.state.data!, series: [toDataFrame([[1, 10, 100]])] } });

    expect(getResolvedSystemTransformations(transformer).prepend).toEqual([
      { ...reduce, origin: 'plugin', position: 'prepend' },
    ]);
  });

  it('leaves an annotations-topic config alone, since only the supplier filters by topic', () => {
    const { transformer } = buildTransformer();
    const annotationsConfig = { id: 'reduce', options: {}, topic: DataTopic.Annotations };

    transformer.setSystemTransformations({ supplier: () => ({ prepend: [annotationsConfig] }) });

    expect(getResolvedSystemTransformations(transformer).prepend).toEqual([
      { ...annotationsConfig, origin: 'plugin', position: 'prepend' },
    ]);
  });
});

describe('NO_SYSTEM_TRANSFORMATIONS', () => {
  it('keeps a stable identity so consumers can use it as an effect dep', () => {
    expect(NO_SYSTEM_TRANSFORMATIONS.prepend).toBe(NO_SYSTEM_TRANSFORMATIONS.prepend);
    expect(NO_SYSTEM_TRANSFORMATIONS.prepend).toEqual([]);
    expect(NO_SYSTEM_TRANSFORMATIONS.append).toEqual([]);
  });
});
