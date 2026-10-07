import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataQueryRequest,
  DataTransformerID,
  FieldType,
  ReducerID,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { ReduceTransformerMode } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { setTemplateSrv } from '@grafana/runtime';
import { DataTopic } from '@grafana/schema';
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

  describe('transformation topic', () => {
    const annotationFrame = (refId: string) =>
      toDataFrame({
        refId,
        fields: [
          { name: 'time', type: FieldType.time, values: [1000] },
          { name: 'text', type: FieldType.string, values: ['deploy'] },
        ],
      });

    const topicData: TransformationData = {
      series: [toDataFrame({ refId: 'A', fields: [{ name: 'value', type: FieldType.number, values: [10] }] })],
      annotations: [toDataFrame({ fields: [{ name: 'text', type: FieldType.string, values: ['deploy'] }] })],
    };

    const rename = (from: string, to: string, topic?: DataTopic): TransformationsEditorTransformation => ({
      id: `rename-${from}-${topic ?? 'series'}`,
      transformation: {
        id: DataTransformerID.organize,
        options: { renameByName: { [from]: to }, indexByName: {}, excludeByName: {} },
        topic,
      },
    });

    const fieldNamesInFilterByNameEditor = () =>
      within(screen.getByTestId(selectors.components.TransformTab.transformationEditor('Filter fields by name')));

    it('edits an annotation-topic transformation against annotation frames, replaying only annotation-topic transformations', async () => {
      setup(
        [
          // Would rename the annotation field first if series-topic transformations were replayed here.
          rename('text', 'renamedBySeriesStep'),
          rename('text', 'renamedByAnnotationStep', DataTopic.Annotations),
          {
            id: 'filter',
            transformation: { id: DataTransformerID.filterFieldsByName, options: {}, topic: DataTopic.Annotations },
          },
        ],
        topicData
      );

      const editor = fieldNamesInFilterByNameEditor();
      expect(await editor.findByRole('button', { name: 'renamedByAnnotationStep' })).toBeInTheDocument();
      expect(editor.queryByRole('button', { name: 'value' })).not.toBeInTheDocument();
      expect(editor.queryByRole('button', { name: 'renamedBySeriesStep' })).not.toBeInTheDocument();
    });

    // Saved dashboards carry either spelling: the topic picker writes `series` once a user has chosen it.
    it.each<{ desc: string; topic: DataTopic | undefined }>([
      { desc: 'unset', topic: undefined },
      { desc: 'explicitly series', topic: DataTopic.Series },
    ])(
      'edits a series-topic transformation against series frames, replaying a preceding step whose topic is $desc but skipping annotation-topic ones',
      async ({ topic }) => {
        setup(
          [
            // Used to be replayed over the series, renaming the field before the series step could.
            rename('value', 'renamedByAnnotationStep', DataTopic.Annotations),
            rename('value', 'renamedBySeriesStep', topic),
            { id: 'filter', transformation: { id: DataTransformerID.filterFieldsByName, options: {} } },
          ],
          topicData
        );

        const editor = fieldNamesInFilterByNameEditor();
        expect(await editor.findByRole('button', { name: 'renamedBySeriesStep' })).toBeInTheDocument();
        expect(editor.queryByRole('button', { name: 'text' })).not.toBeInTheDocument();
        expect(editor.queryByRole('button', { name: 'renamedByAnnotationStep' })).not.toBeInTheDocument();
      }
    );

    it('names an annotation-topic transformation after the annotation frames it merges, not the series', async () => {
      setup([{ id: 'a', transformation: { id: DataTransformerID.merge, options: {}, topic: DataTopic.Annotations } }], {
        series: seriesData.series,
        annotations: [annotationFrame('X'), annotationFrame('Y')],
      });

      expect(await screen.findByText('merge-X-Y')).toBeInTheDocument();
    });

    describe('names taken by the frames a transformation receives', () => {
      // B was requested but returned nothing, so only the requested-targets backfill can reserve it.
      const requestedBData: TransformationData = {
        request: { targets: [{ refId: 'A' }, { refId: 'B' }] } as DataQueryRequest,
        series: topicData.series,
        annotations: [annotationFrame('X')],
      };

      const mergeRow = (topic?: DataTopic): TransformationsEditorTransformation => ({
        id: 'a',
        transformation: { id: DataTransformerID.merge, options: {}, topic },
      });

      const typeName = async (value: string) => {
        await userEvent.click(screen.getByTestId('transformation-refid-div'));
        await userEvent.type(screen.getByTestId('transformation-refid-input'), value);
      };

      it('rejects the name of a requested query that returned no frames for a series-topic transformation', async () => {
        const { onChange } = setup([mergeRow()], requestedBData);

        await typeName('B');
        expect(
          await screen.findByText('Transformation name is already used by a query or an earlier transformation')
        ).toBeInTheDocument();

        await userEvent.click(document.body);
        expect(onChange).not.toHaveBeenCalled();
      });

      it('accepts that name for an annotation-topic transformation, whose frames do not come from the requested queries', async () => {
        const { onChange } = setup([mergeRow(DataTopic.Annotations)], requestedBData);

        await typeName('B');
        await userEvent.click(document.body);

        expect(onChange).toHaveBeenCalledWith(0, {
          id: DataTransformerID.merge,
          options: {},
          topic: DataTopic.Annotations,
          refId: 'B',
        });
      });
    });
  });
});
