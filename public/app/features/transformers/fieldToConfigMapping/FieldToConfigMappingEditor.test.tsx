import { fireEvent, render, screen, getByText, getByLabelText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { toDataFrame, FieldType } from '@grafana/data';

import { Props, FieldToConfigMappingEditor } from './FieldToConfigMappingEditor';

beforeEach(() => {
  jest.clearAllMocks();
});

const frame = toDataFrame({
  fields: [
    { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
    { name: 'Miiin', type: FieldType.number, values: [3, 100] },
    { name: 'max', type: FieldType.string, values: [15, 200] },
  ],
});

const mockOnChange = jest.fn();

const props: Props = {
  frame: frame,
  onChange: mockOnChange,
  mappings: [],
  withReducers: true,
};

const setup = (testProps?: Partial<Props>) => {
  const editorProps = { ...props, ...testProps };
  return render(<FieldToConfigMappingEditor {...editorProps} />);
};

describe('FieldToConfigMappingEditor', () => {
  it('Should render fields', async () => {
    setup();

    expect(await screen.findByText('Unit')).toBeInTheDocument();
    expect(await screen.findByText('Miiin')).toBeInTheDocument();
    expect(await screen.findByText('max')).toBeInTheDocument();
    expect(await screen.findByText('Max (auto)')).toBeInTheDocument();
  });

  it('Can change mapping', async () => {
    setup();

    const select = (await screen.findByTestId('Miiin-config-key')).childNodes[0];
    await fireEvent.keyDown(select, { keyCode: 40 });
    await selectOptionInTest(select as HTMLElement, 'Min');

    expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([{ fieldName: 'Miiin', handlerKey: 'min' }]));
  });

  it('Can remove added mapping', async () => {
    setup({ mappings: [{ fieldName: 'max', handlerKey: 'min' }] });

    const select = (await screen.findByTestId('max-config-key')).childNodes[0];
    await userEvent.click(getByLabelText(select as HTMLElement, 'Clear value'));

    expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([]));
  });

  it('Automatic mapping is shown as placeholder', async () => {
    setup({ mappings: [] });

    const select = await screen.findByText('Max (auto)');
    expect(select).toBeInTheDocument();
  });

  it('Should show correct default reducer', async () => {
    setup({ mappings: [{ fieldName: 'max', handlerKey: 'mappings.value' }] });

    const reducer = await screen.findByTestId('max-reducer');

    expect(getByText(reducer, 'All values')).toBeInTheDocument();
  });

  it('Can change reducer', async () => {
    setup();

    const reducer = await (await screen.findByTestId('max-reducer')).childNodes[0];

    await fireEvent.keyDown(reducer, { keyCode: 40 });
    await selectOptionInTest(reducer as HTMLElement, 'Last');

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.arrayContaining([{ fieldName: 'max', handlerKey: 'max', reducerId: 'last' }])
    );
  });

  it('Shows additional settings', async () => {
    setup({ mappings: [{ fieldName: 'max', handlerKey: 'threshold1' }] });

    const select = await screen.findByText('Additional settings');
    expect(select).toBeInTheDocument();
  });

  it('Does not show additional settings', async () => {
    setup();

    const select = screen.queryByText('Additional settings');
    expect(select).not.toBeInTheDocument();
  });
});
