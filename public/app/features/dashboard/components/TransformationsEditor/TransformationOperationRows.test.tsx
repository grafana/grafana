import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  BinaryOperationID,
  DataTransformerID,
  FieldMatcherID,
  FieldType,
  FrameMatcherID,
  ReducerID,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { CalculateFieldMode, ReduceTransformerMode } from '@grafana/data/internal';
import { setTemplateSrv } from '@grafana/runtime';
import { ConstantVariable, EmbeddedScene, SceneCanvasText, SceneVariableSet } from '@grafana/scenes';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { TransformationOperationRows } from './TransformationOperationRows';
import { type TransformationData, type TransformationsEditorTransformation } from './types';

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
  const rows = (rowData: TransformationData) => (
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="transformations-list" direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <TransformationOperationRows data={rowData} configs={configs} onRemove={onRemove} onChange={onChange} />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
  const view = render(rows(transformationData));
  return { onRemove, onChange, rerender: (rowData: TransformationData) => view.rerender(rows(rowData)) };
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

  describe('within a scene', () => {
    let prevContext: typeof window.__grafanaSceneContext;

    beforeEach(() => {
      prevContext = window.__grafanaSceneContext;
      window.__grafanaSceneContext = new EmbeddedScene({
        $variables: new SceneVariableSet({
          variables: [
            new ConstantVariable({ name: 'const', value: '10' }),
            new ConstantVariable({ name: 'brokenRegex', value: '/unclosed' }),
          ],
        }),
        body: new SceneCanvasText({ text: '' }),
      });
      window.__grafanaSceneContext.activate();
    });

    afterEach(() => {
      window.__grafanaSceneContext = prevContext;
      jest.restoreAllMocks();
    });

    it('offers a field calculated with a variable to the next transformation', async () => {
      setup(
        [
          {
            id: 'a',
            transformation: {
              id: DataTransformerID.calculateField,
              options: {
                mode: CalculateFieldMode.BinaryOperation,
                alias: 'plus',
                binary: {
                  left: { matcher: { id: FieldMatcherID.byName, options: 'value' } },
                  operator: BinaryOperationID.Add,
                  right: { matcher: { id: FieldMatcherID.byName, options: '$const' } },
                },
              },
            },
          },
          {
            id: 'b',
            transformation: {
              id: DataTransformerID.calculateField,
              options: { mode: CalculateFieldMode.BinaryOperation },
            },
          },
        ],
        {
          series: [
            toDataFrame({
              refId: 'A',
              fields: [
                { name: 'time', type: FieldType.time, values: [1, 2] },
                { name: 'value', type: FieldType.number, values: [10, 20] },
              ],
            }),
          ],
          annotations: [],
        }
      );

      const leftOperands = await screen.findAllByRole('combobox', { name: 'Left operand' });
      await userEvent.click(leftOperands[1]);

      const menu = await screen.findByLabelText('Select options menu');
      expect(await within(menu).findByText('plus')).toBeInTheDocument();
    });

    it('keeps the rows rendered when a filter variable resolves to an invalid regex, logging once per row', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const replayFailures = () =>
        consoleError.mock.calls.filter(([message]) => message === 'Failed to replay transformations for the editor');
      const reduce = { id: DataTransformerID.reduce, options: { reducers: [ReducerID.max] } };

      const { rerender } = setup(
        [
          { id: 'a', transformation: { ...reduce, filter: { id: FrameMatcherID.byName, options: '$brokenRegex' } } },
          { id: 'b', transformation: { ...reduce } },
        ],
        seriesData
      );

      expect(await screen.findByText('1 - Reduce')).toBeInTheDocument();
      expect(screen.getByText('2 - Reduce')).toBeInTheDocument();
      await waitFor(() => expect(replayFailures()).toHaveLength(2));

      rerender({ ...seriesData });
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

      expect(replayFailures()).toHaveLength(2);
    });

    it('still gives a row with an invalid filter regex its input fields', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      setup(
        [
          {
            id: 'a',
            transformation: {
              id: DataTransformerID.calculateField,
              options: { mode: CalculateFieldMode.BinaryOperation },
              filter: { id: FrameMatcherID.byName, options: '$brokenRegex' },
            },
          },
        ],
        {
          series: [
            toDataFrame({
              refId: 'A',
              fields: [
                { name: 'time', type: FieldType.time, values: [1, 2] },
                { name: 'value', type: FieldType.number, values: [10, 20] },
              ],
            }),
          ],
          annotations: [],
        }
      );

      await userEvent.click(await screen.findByRole('combobox', { name: 'Left operand' }));

      const menu = await screen.findByLabelText('Select options menu');
      expect(await within(menu).findByText('value')).toBeInTheDocument();
    });
  });
});
