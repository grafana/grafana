import { renderHook, waitFor } from '@testing-library/react';

import {
  type DataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { type AdhocTransformsState } from './ViewPanelSidePane';
import { useAdhocTransforms } from './ViewPanelWrapper';

standardTransformersRegistry.setInit(getStandardTransformers);

describe('useAdhocTransforms', () => {
  it('returns the data untouched when there are no adhoc transforms', () => {
    const data = buildPanelData();
    const { result } = renderHook(() => useAdhocTransforms(data, undefined));

    expect(result.current).toEqual([data, false]);
  });

  it('reports loading until the organize transformation has been applied', async () => {
    const data = buildPanelData();
    const { result } = renderHook(() => useAdhocTransforms(data, buildOrganizeState({ excludeByName: { cpu: true } })));

    // The transformer implementation is loaded lazily, so the first render has no transformed series yet
    expect(result.current).toEqual([data, true]);

    await waitFor(() => expect(result.current[1]).toBe(false));
  });

  it('removes excluded fields and orders the remaining ones by indexByName', async () => {
    const data = buildPanelData();
    const { result } = renderHook(() =>
      useAdhocTransforms(data, buildOrganizeState({ excludeByName: { cpu: true }, indexByName: { mem: 0, time: 1 } }))
    );

    await waitFor(() => expect(result.current[1]).toBe(false));

    expect(getFieldNames(result.current[0]!.series)).toEqual([['mem', 'time']]);
    expect(result.current[0]!.state).toBe(LoadingState.Done);
  });

  it('applies the transformation to the new series when the data changes', async () => {
    const adhocTransforms = buildOrganizeState({ excludeByName: { cpu: true } });
    const { result, rerender } = renderHook(({ data }) => useAdhocTransforms(data, adhocTransforms), {
      initialProps: { data: buildPanelData() },
    });

    await waitFor(() => expect(getFieldNames(result.current[0]!.series)).toEqual([['time', 'mem']]));

    rerender({ data: buildPanelData([buildFrame(['time', 'cpu', 'disk'])]) });

    await waitFor(() => expect(getFieldNames(result.current[0]!.series)).toEqual([['time', 'disk']]));
  });
});

function buildOrganizeState(organize: Partial<AdhocTransformsState['organize']>): AdhocTransformsState {
  return { organize: { excludeByName: {}, indexByName: {}, renameByName: {}, ...organize } };
}

function getFieldNames(series: DataFrame[]) {
  return series.map((frame) => frame.fields.map((field) => field.name));
}

function buildFrame(fieldNames: string[]): DataFrame {
  return toDataFrame({
    fields: fieldNames.map((name) => ({
      name,
      values: [1, 2, 3],
      type: name === 'time' ? FieldType.time : FieldType.number,
    })),
  });
}

function buildPanelData(series: DataFrame[] = [buildFrame(['time', 'cpu', 'mem'])]): PanelData {
  return { series, state: LoadingState.Done, timeRange: getDefaultTimeRange() };
}
