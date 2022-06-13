import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { toDataFrame, FieldType } from '@grafana/data';

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

    const select = (await screen.findByTestId('Name-config-key')).childNodes[0];
    await fireEvent.keyDown(select, { keyCode: 40 });
    await selectOptionInTest(select as HTMLElement, 'Field name');

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mappings: [{ fieldName: 'Name', handlerKey: 'field.name' }],
      })
    );
  });

  it('Should be able to select value field', async () => {
    setup();

    const select = (await screen.findByTestId('Value-config-key')).childNodes[0];
    await fireEvent.keyDown(select, { keyCode: 40 });
    await selectOptionInTest(select as HTMLElement, 'Field value');

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mappings: [{ fieldName: 'Value', handlerKey: 'field.value' }],
      })
    );
  });
});
