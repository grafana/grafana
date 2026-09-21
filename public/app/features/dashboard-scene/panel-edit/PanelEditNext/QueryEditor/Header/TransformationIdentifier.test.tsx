import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataTransformerConfig,
  DataTransformerID,
  FieldType,
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

import { type Transformation } from '../types';

import { TransformationIdentifier } from './TransformationIdentifier';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (v: string) => v }),
}));

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
});
