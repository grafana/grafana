import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ValueMappingsEditorModal, Props } from './ValueMappingsEditorModal';
import { MappingType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import selectEvent from 'react-select-event';

const setup = (spy?: any, propOverrides?: object) => {
  const props: Props = {
    onClose: jest.fn(),
    onChange: (mappings: any) => {
      if (spy) {
        spy(mappings);
      }
    },
    value: [
      {
        type: MappingType.ValueToText,
        options: {
          '20': {
            text: 'Ok',
            index: 0,
          },
        },
      },
      {
        type: MappingType.RangeToText,
        options: {
          from: 21,
          to: 30,
          result: {
            text: 'Meh',
            index: 1,
          },
        },
      },
    ],
  };

  Object.assign(props, propOverrides);

  render(<ValueMappingsEditorModal {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    setup();
  });
});

describe('On remove mapping', () => {
  it('Should remove mapping at index 0', () => {
    const onChangeSpy = jest.fn();
    setup(onChangeSpy);

    screen.getAllByTestId('remove-value-mapping')[0].click();
    screen.getByText('Update').click();

    expect(onChangeSpy).toBeCalledWith([
      {
        type: MappingType.RangeToText,
        options: {
          from: 21,
          to: 30,
          result: {
            text: 'Meh',
            index: 0,
          },
        },
      },
    ]);
  });
});

describe('When adding and updating value mapp', () => {
  it('should be 3', async () => {
    const onChangeSpy = jest.fn();
    setup(onChangeSpy);

    fireEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
    const selectComponent = await screen.findByLabelText(selectors.components.ValuePicker.select('Add a new mapping'));

    await selectEvent.select(selectComponent, 'Value', { container: document.body });

    const input = (await screen.findAllByPlaceholderText('Exact value to match'))[1];

    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.change(screen.getAllByPlaceholderText('Optional display text')[2], { target: { value: 'display' } });
    fireEvent.click(screen.getByText('Update'));

    expect(onChangeSpy).toBeCalledWith([
      {
        type: MappingType.ValueToText,
        options: {
          '20': {
            text: 'Ok',
            index: 0,
          },
          New: {
            text: 'display',
            index: 2,
          },
        },
      },
      {
        type: MappingType.RangeToText,
        options: {
          from: 21,
          to: 30,
          result: {
            text: 'Meh',
            index: 1,
          },
        },
      },
    ]);
  });
});

describe('When adding and updating range map', () => {
  it('should add new range map', async () => {
    const onChangeSpy = jest.fn();
    setup(onChangeSpy, { value: [] });

    fireEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
    const selectComponent = await screen.findByLabelText(selectors.components.ValuePicker.select('Add a new mapping'));
    await selectEvent.select(selectComponent, 'Range', { container: document.body });

    fireEvent.change(screen.getByPlaceholderText('Range start'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Range end'), { target: { value: '20' } });
    fireEvent.change(screen.getByPlaceholderText('Optional display text'), { target: { value: 'display' } });

    fireEvent.click(screen.getByText('Update'));

    expect(onChangeSpy).toBeCalledWith([
      {
        type: MappingType.RangeToText,
        options: {
          from: 10,
          to: 20,
          result: {
            text: 'display',
            index: 0,
          },
        },
      },
    ]);
  });
});
