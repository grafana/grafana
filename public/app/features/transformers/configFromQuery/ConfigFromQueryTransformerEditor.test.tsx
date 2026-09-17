import { fireEvent, render, screen } from '@testing-library/react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { toDataFrame, FieldType } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { type Props, ConfigFromQueryTransformerEditor } from './ConfigFromQueryTransformerEditor';
import { CustomCFQMatchers } from './configFromQuery';

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
  refId: 'config',
});

const data = toDataFrame({
  fields: [
    { name: 'Temperature', type: FieldType.number, values: [1, 2] },
    { name: 'Pressure', type: FieldType.number, values: [1, 2] },
  ],
  refId: 'data',
});

const mockOnChange = jest.fn();

const props: Props = {
  input: [input],
  onChange: mockOnChange,
  options: {
    mappings: [],
  },
};

const setup = (testProps?: Partial<Props>) => {
  const editorProps = { ...props, ...testProps };
  return render(<ConfigFromQueryTransformerEditor {...editorProps} />);
};

function setupDynamicData(testProps?: Partial<Props>) {
  return setup({
    input: [input, data],
    options: {
      configRefId: 'config',
      applyTo: {
        id: CustomCFQMatchers.dynamicFieldName,
        options: 'Name',
      },
      mappings: [],
    },
    ...testProps,
  });
}

describe('ConfigFromQueryTransformerEditor', () => {
  it('Should be able to select config frame by refId', async () => {
    setup();

    let select = (await screen.findByText('Config query')).nextSibling!.firstChild!;
    await fireEvent.keyDown(select, { keyCode: 40 });
    await selectOptionInTest(select as HTMLElement, 'config');

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configRefId: 'config',
      })
    );
  });

  describe('Dynamic Field Matcher', () => {
    beforeEach(() => {
      setTestFlags({ 'grafana.configFromQueryDynamicName': true });
    });

    it('Should be able to select the dynamic field matcher', async () => {
      setup();

      let configQuerySelect = (await screen.findByText('Config query')).nextSibling!.firstChild!;
      await fireEvent.keyDown(configQuerySelect, { keyCode: 40 });
      await selectOptionInTest(configQuerySelect as HTMLElement, 'config');

      let configApplyToSelect = (await screen.findByText('Apply to')).nextSibling!.firstChild!;
      await fireEvent.keyDown(configApplyToSelect, { keyCode: 40 });
      await selectOptionInTest(configApplyToSelect as HTMLElement, 'Fields with dynamic names');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          applyTo: {
            id: CustomCFQMatchers.dynamicFieldName,
          },
        })
      );
    });

    it('Should only let config query fields to be selected for option', async () => {
      setup({
        options: {
          mappings: [],
          applyTo: {
            id: CustomCFQMatchers.dynamicFieldName,
          },
        },
      });

      let select = await screen.findByText('Apply to options');
      await fireEvent.keyDown(select, { keyCode: 40 });
      expect(screen.queryByText('Temperature')).not.toBeInTheDocument();
      expect(screen.queryByText('Name')).toBeInTheDocument();
    });

    it('Should not show the selected dynamic field name as a mapping', async () => {
      setupDynamicData();

      expect(screen.queryByText('Name')).not.toBeInTheDocument();
    });

    it('Should not allow reducers', async () => {
      setupDynamicData();
      expect(screen.queryByText('Select')).not.toBeInTheDocument();
    });
  });
});
