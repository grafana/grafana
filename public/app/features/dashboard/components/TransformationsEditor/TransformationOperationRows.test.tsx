import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { standardTransformersRegistry } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { TransformationOperationRows } from './TransformationOperationRows';
import { type TransformationData } from './TransformationsEditor';
import { type TransformationsEditorTransformation } from './types';

const data: TransformationData = { series: [], annotations: [] };

standardTransformersRegistry.setInit(getStandardTransformers);

const setup = (configs: TransformationsEditorTransformation[]) => {
  const onRemove = jest.fn();
  const onChange = jest.fn();
  render(
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="transformations-list" direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <TransformationOperationRows data={data} configs={configs} onRemove={onRemove} onChange={onChange} />
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
  return { onRemove, onChange };
};

describe('TransformationOperationRows', () => {
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
});
