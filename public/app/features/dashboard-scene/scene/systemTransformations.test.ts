import {
  type CustomTransformOperator,
  type DataFrame,
  type DataTransformerConfig,
  LoadingState,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import {
  SceneDataNode,
  SceneDataTransformer,
  SceneObjectBase,
  type SceneObjectState,
  type SystemTransformationsProvider,
} from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';

import { NO_SYSTEM_TRANSFORMATIONS, getResolvedSystemTransformations } from './systemTransformations';

const passthrough: CustomTransformOperator = () => (source) => source;
const reduce = { id: 'reduce', options: {} };
const series = [toDataFrame([[1, 10]])];

type Resolve = (ctx: { series: DataFrame[] }) => {
  prepend?: Array<DataTransformerConfig | CustomTransformOperator>;
  append?: Array<DataTransformerConfig | CustomTransformOperator>;
};

interface StubProviderState extends SceneObjectState {
  child?: SceneDataTransformer;
  resolve: Resolve;
}

/**
 * Stands in for the VizPanel a dashboard transformer hangs under. What this file tests is the
 * unwrapping and memoization on top of what scenes resolved, not how VizPanel picks a plugin.
 */
class StubProvider extends SceneObjectBase<StubProviderState> implements SystemTransformationsProvider {
  public origin = 'plugin';
  public calls = 0;

  public getSystemTransformations(_transformer: SceneDataTransformer, ctx: { series: DataFrame[] }) {
    this.calls++;
    return this.state.resolve(ctx);
  }
}

function buildTransformer(resolve: Resolve, sourceSeries: DataFrame[] = series) {
  const source = new SceneDataNode({
    data: { state: LoadingState.Done, series: sourceSeries, timeRange: getDefaultTimeRange() },
  });
  const transformer = new SceneDataTransformer({ $data: source, transformations: [] });
  const provider = new StubProvider({ resolve, child: transformer });

  source.activate();
  transformer.activate();

  return { source, transformer, provider };
}

describe('getResolvedSystemTransformations', () => {
  it('returns the shared empty result when nothing resolves for the current frames', () => {
    const { transformer } = buildTransformer(() => ({}));

    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);
  });

  it('unwraps a custom operator back to the function the plugin registered', () => {
    const { transformer } = buildTransformer(() => ({ prepend: [passthrough], append: [reduce] }));

    const { prepend, append } = getResolvedSystemTransformations(transformer);

    // Scenes normalizes a bare operator into `{ operator, topic }` so it can tag it; readers feed
    // these to `transformDataFrame`, which takes the function
    expect(prepend).toEqual([passthrough]);
    expect(append).toEqual([{ ...reduce, origin: 'plugin', position: 'append' }]);
  });

  it('keeps a stable identity across calls while the frames are unchanged', () => {
    const { transformer } = buildTransformer(() => ({ prepend: [passthrough] }));

    // Editor rows use these arrays as effect deps, so a fresh identity per render replays them all
    expect(getResolvedSystemTransformations(transformer)).toBe(getResolvedSystemTransformations(transformer));
  });

  it('keeps a stable identity before the first query result', () => {
    const { transformer, provider } = buildTransformer(() => ({}), []);

    // Resolving against no frames must not churn either: scenes stands in a shared array for the
    // missing series, so the memo still hits
    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);
    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);
    expect(provider.calls).toBe(1);
  });

  it('resolves again for a new frame set', () => {
    const { source, transformer } = buildTransformer(({ series: frames }) =>
      frames[0].fields.length > 2 ? { prepend: [reduce] } : {}
    );

    expect(getResolvedSystemTransformations(transformer)).toBe(NO_SYSTEM_TRANSFORMATIONS);

    source.setState({ data: { ...source.state.data!, series: [toDataFrame([[1, 10, 100]])] } });

    expect(getResolvedSystemTransformations(transformer).prepend).toEqual([
      { ...reduce, origin: 'plugin', position: 'prepend' },
    ]);
  });

  it('leaves an annotations-topic config alone, since only the provider filters by topic', () => {
    const annotationsConfig = { id: 'reduce', options: {}, topic: DataTopic.Annotations };
    const { transformer } = buildTransformer(() => ({ prepend: [annotationsConfig] }));

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
