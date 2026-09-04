import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TransformationOperationRows } from './TransformationOperationRows';
import { type TransformationData } from './TransformationsEditor';

const data: TransformationData = { series: [] };

const unknownTransformation = {
  id: '0',
  transformation: { id: 'not-a-registered-transformation', options: {} },
};

describe('TransformationOperationRows', () => {
  it('names a transformation the registry does not know', () => {
    render(
      <TransformationOperationRows
        data={data}
        configs={[unknownTransformation]}
        onRemove={jest.fn()}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('not-a-registered-transformation');
  });

  it('removes an unknown transformation from the panel', async () => {
    const onRemove = jest.fn();

    render(
      <TransformationOperationRows
        data={data}
        configs={[unknownTransformation]}
        onRemove={onRemove}
        onChange={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
