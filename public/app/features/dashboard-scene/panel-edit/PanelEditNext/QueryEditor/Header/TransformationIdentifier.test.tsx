import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataTransformerConfig,
  DataTransformerID,
  FieldType,
  FrameMatcherID,
  LoadingState,
  type PanelData,
  type TransformerRegistryItem,
  dateTime,
  toDataFrame,
} from '@grafana/data';
import {
  mergeTransformer,
  mockTransformationsRegistry,
  reduceTransformer,
  ReduceTransformerMode,
} from '@grafana/data/internal';

import { usePreviousTransformationOutput } from '../hooks/usePreviousTransformationOutput';
import { useTransformationGeneratedRefId } from '../hooks/useTransformationGeneratedRefId';
import { type Transformation } from '../types';

import { TransformationIdentifier } from './TransformationIdentifier';

let mockReplace: (v: string) => string = (v) => v;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => mockReplace(v) }),
}));

// Wrapped rather than replaced, so the suite still exercises the real hooks while it can also
// assert that the plain-text path never reaches them.
jest.mock('../hooks/useTransformationGeneratedRefId', () => {
  const actual = jest.requireActual('../hooks/useTransformationGeneratedRefId');
  return { useTransformationGeneratedRefId: jest.fn(actual.useTransformationGeneratedRefId) };
});

jest.mock('../hooks/usePreviousTransformationOutput', () => {
  const actual = jest.requireActual('../hooks/usePreviousTransformationOutput');
  return { usePreviousTransformationOutput: jest.fn(actual.usePreviousTransformationOutput) };
});

const seriesA = toDataFrame({
  refId: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000] },
    { name: 'value', type: FieldType.number, values: [1, 2] },
  ],
});

const seriesB = toDataFrame({
  refId: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [3000, 4000] },
    { name: 'value', type: FieldType.number, values: [3, 4] },
  ],
});

const seriesC = toDataFrame({
  refId: 'C',
  fields: [
    { name: 'time', type: FieldType.time, values: [5000, 6000] },
    { name: 'value', type: FieldType.number, values: [5, 6] },
  ],
});

function getData(series = [seriesA, seriesB]): PanelData {
  return {
    state: LoadingState.Done,
    series,
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
  };
}

function getTransformation(
  transformConfig: DataTransformerConfig,
  usesDynamicRefId: TransformerRegistryItem['usesDynamicRefId']
): Transformation {
  return {
    transformId: `${transformConfig.id}-0`,
    transformConfig,
    // Only the fields TransformationIdentifier reads; the registry supplies the runtime behaviour.
    registryItem: { id: transformConfig.id, name: 'Merge series/tables', usesDynamicRefId } as TransformerRegistryItem,
  };
}

function renderIdentifier(transformation: Transformation, onUpdate = jest.fn(), data = getData()) {
  render(
    <TransformationIdentifier
      transformation={transformation}
      transformations={[transformation]}
      data={data}
      fallbackName="Merge series/tables"
      onUpdate={onUpdate}
    />
  );
  return onUpdate;
}

describe('TransformationIdentifier', () => {
  beforeAll(() => {
    mockTransformationsRegistry([mergeTransformer, reduceTransformer]);
  });

  beforeEach(() => {
    mockReplace = (v) => v;
    jest.mocked(useTransformationGeneratedRefId).mockClear();
    jest.mocked(usePreviousTransformationOutput).mockClear();
  });

  it('offers the generated name as the placeholder until one is pinned', async () => {
    const transformation = getTransformation({ id: DataTransformerID.merge, options: {} }, true);
    renderIdentifier(transformation);

    expect(await screen.findByText('merge-A-B')).toBeInTheDocument();
  });

  it('saves a pinned name', async () => {
    const transformation = getTransformation({ id: DataTransformerID.merge, options: {} }, true);
    const onUpdate = renderIdentifier(transformation);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /edit transformation name/i }));
    await user.type(screen.getByTestId('transformation-refid-input'), 'T-A');
    await user.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith(transformation.transformConfig, {
      ...transformation.transformConfig,
      refId: 'T-A',
    });
  });

  it('clears a pinned name back to the generated one rather than saving a blank', async () => {
    const transformation = getTransformation({ id: DataTransformerID.merge, options: {}, refId: 'T-A' }, true);
    const onUpdate = renderIdentifier(transformation);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /edit transformation name/i }));
    await user.clear(screen.getByTestId('transformation-refid-input'));
    await user.click(document.body);

    expect(onUpdate).toHaveBeenCalledWith(transformation.transformConfig, {
      ...transformation.transformConfig,
      refId: undefined,
    });
  });

  it('rejects a name already used by a query in the input', async () => {
    const transformation = getTransformation({ id: DataTransformerID.merge, options: {} }, true);
    const onUpdate = renderIdentifier(transformation);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /edit transformation name/i }));
    await user.type(screen.getByTestId('transformation-refid-input'), 'A');

    expect(
      await screen.findByText('Transformation name is already used by a query or an earlier transformation')
    ).toBeInTheDocument();

    await user.click(document.body);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('shows plain text for a transformation that produces no frame of its own', async () => {
    const transformation = getTransformation(
      { id: DataTransformerID.reduce, options: { mode: ReduceTransformerMode.ReduceFields, reducers: ['max'] } },
      (options) => options?.mode !== ReduceTransformerMode.ReduceFields
    );
    renderIdentifier(transformation);

    expect(await screen.findByText('Merge series/tables')).toBeInTheDocument();
    // Still absent once the replay settles, not merely before it has run.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /edit transformation name/i })).not.toBeInTheDocument()
    );
  });

  it('does not replay the pipeline for a transformation that shows plain text', async () => {
    const transformation = getTransformation(
      { id: DataTransformerID.reduce, options: { mode: ReduceTransformerMode.ReduceFields, reducers: ['max'] } },
      (options) => options?.mode !== ReduceTransformerMode.ReduceFields
    );
    renderIdentifier(transformation);

    expect(await screen.findByText('Merge series/tables')).toBeInTheDocument();
    // Each replay walks every preceding transformation, so a row that cannot use the result must
    // not start one — the stacked editor mounts an identifier per transformation.
    expect(useTransformationGeneratedRefId).not.toHaveBeenCalled();
    expect(usePreviousTransformationOutput).not.toHaveBeenCalled();
  });

  it('replays the pipeline for a transformation that can be named', async () => {
    const transformation = getTransformation({ id: DataTransformerID.merge, options: {} }, true);
    renderIdentifier(transformation);

    expect(await screen.findByText('merge-A-B')).toBeInTheDocument();
    expect(useTransformationGeneratedRefId).toHaveBeenCalled();
    expect(usePreviousTransformationOutput).toHaveBeenCalled();
  });

  it('names the output of a filtered transformation, ignoring the frames the filter excluded', async () => {
    const transformation = getTransformation(
      { id: DataTransformerID.merge, options: {}, filter: { id: FrameMatcherID.byRefId, options: 'A|B' } },
      true
    );
    renderIdentifier(transformation, jest.fn(), getData([seriesA, seriesB, seriesC]));

    // C is spliced back into the output untouched, so it is not this transformation's to name.
    expect(await screen.findByText('merge-A-B')).toBeInTheDocument();
  });

  it('resolves a variable in the filter before working out the name', async () => {
    mockReplace = (v) => v.replace(/\$refs/g, 'A|B');
    const transformation = getTransformation(
      { id: DataTransformerID.merge, options: {}, filter: { id: FrameMatcherID.byRefId, options: '$refs' } },
      true
    );
    renderIdentifier(transformation, jest.fn(), getData([seriesA, seriesB, seriesC]));

    // Matching on the literal `$refs` would admit no frames at all, leaving nothing to name.
    expect(await screen.findByText('merge-A-B')).toBeInTheDocument();
  });

  it('falls back to no filter when the configured one cannot be built into a matcher', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const transformation = getTransformation(
      { id: DataTransformerID.merge, options: {}, filter: { id: 'no-such-matcher', options: 'A' } },
      true
    );
    renderIdentifier(transformation, jest.fn(), getData([seriesA, seriesB, seriesC]));

    // A throw here would take the whole editor down, since this runs during render.
    expect(await screen.findByRole('button', { name: /edit transformation name/i })).toBeInTheDocument();
  });
});
