import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataTransformerID, FieldType, ReducerID, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { ReduceTransformerMode } from '@grafana/data/internal';
import { setTemplateSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { TransformationOperationRows } from './TransformationOperationRows';
import { type TransformationData } from './TransformationsEditor';
import { type TransformationsEditorTransformation } from './types';

const data: TransformationData = { series: [], annotations: [] };

const seriesData: TransformationData = {
  series: [
    toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    }),
    toDataFrame({
      refId: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'value', type: FieldType.number, values: [30, 40] },
      ],
    }),
  ],
  annotations: [],
};

standardTransformersRegistry.setInit(getStandardTransformers);

const setup = (configs: TransformationsEditorTransformation[], transformationData: TransformationData = data) => {
  const onRemove = jest.fn();
  const onChange = jest.fn();
  render(
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="transformations-list" direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <TransformationOperationRows
              data={transformationData}
              configs={configs}
              onRemove={onRemove}
              onChange={onChange}
            />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
  return { onRemove, onChange };
};

describe('TransformationOperationRows', () => {
  // The rows interpolate every transformation config before replaying it.
  beforeAll(() => {
    setTemplateSrv(new TemplateSrv());
  });

  it('renders an error with the transformation id when the id is not recognized', () => {
    setup([{ id: 'a', transformation: { id: 'not-a-real-transformation', options: {} } }]);

    expect(screen.getByText('Unknown transformation: not-a-real-transformation')).toBeInTheDocument();
  });

  it('removes the unrecognized transformation when the remove button is clicked', async () => {
    const { onRemove } = setup([
      { id: 'a', transformation: { id: 'unknown-transformation-one', options: {} } },
      { id: 'b', transformation: { id: 'unknown-transformation-two', options: {} } },
    ]);

    const alert = screen.getByRole('alert', { name: 'Unknown transformation: unknown-transformation-two' });
    await userEvent.click(within(alert).getByRole('button', { name: 'Remove' }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('shows the name reduce gives the frame it emits', async () => {
    setup(
      [{ id: 'a', transformation: { id: DataTransformerID.reduce, options: { reducers: [ReducerID.max] } } }],
      seriesData
    );

    expect(await screen.findByText('reduce-A-B')).toBeInTheDocument();
  });

  it('shows no name for reduce in fields mode, which keeps the incoming refIds', async () => {
    setup(
      [
        {
          id: 'a',
          transformation: {
            id: DataTransformerID.reduce,
            options: { reducers: [ReducerID.max], mode: ReduceTransformerMode.ReduceFields },
          },
        },
      ],
      seriesData
    );

    expect(await screen.findByText('1 - Reduce')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-refid-div')).not.toBeInTheDocument();
  });
});
