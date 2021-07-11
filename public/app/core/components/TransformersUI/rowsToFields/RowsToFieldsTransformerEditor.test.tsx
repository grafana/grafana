import React from 'react';
import { toDataFrame, FieldType } from '@grafana/data';
import { fireEvent, render, screen, getByText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Props, RowsToFieldsTransformerEditor } from './RowsToFieldsTransformerEditor';

beforeEach(() => {
  jest.clearAllMocks();
});

const input = toDataFrame({
  fields: [
    { name: 'Name', type: FieldType.string, values: ['Temperature', 'Pressure'] },
    { name: 'Value', type: FieldType.number, values: [10, 200] },
    { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
    { name: 'Miiin', type: FieldType.number, values: [3, 100] },
    { name: 'max', type: FieldType.string, values: [15, 200] },
  ],
});

const mockOnChange = jest.fn();

const props: Props = {
  input: [input],
  onChange: mockOnChange,
  options: {},
};

const setup = (testProps?: Partial<Props>) => {
  const editorProps = { ...props, ...testProps };
  return render(<RowsToFieldsTransformerEditor {...editorProps} />);
};

describe('RowsToFieldsTransformerEditor', () => {
  it('Should be able to select name field', async () => {
    setup();

    let select = (await screen.findByText('Name field')).nextSibling!;
    await fireEvent.keyDown(select, { keyCode: 40 });
    const scs = screen.getAllByLabelText('Select option');
    await userEvent.click(getByText(select as HTMLElement, 'Name'));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nameField: 'Name',
      })
    );
  });

  it('Should be able to value field', async () => {
    setup();

    let select = (await screen.findByText('Value field')).nextSibling!;
    await fireEvent.keyDown(select, { keyCode: 40 });
    const scs = screen.getAllByLabelText('Select option');
    await userEvent.click(getByText(select as HTMLElement, 'Value'));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        valueField: 'Value',
      })
    );
  });
});
