import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { MappingType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { ValueMappingsEditorModal, Props } from './ValueMappingsEditorModal';

const setup = (spy?: jest.Mock, propOverrides?: Partial<Props>) => {
  const props: Props = {
    onClose: jest.fn(),
    onChange: (mappings) => {
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

describe('ValueMappingsEditorModal', () => {
  it('should render component', () => {
    setup();
  });

  describe('On remove mapping', () => {
    it('Should remove mapping at index 0', async () => {
      const onChangeSpy = jest.fn();
      setup(onChangeSpy);

      await userEvent.click(screen.getAllByTestId('remove-value-mapping')[0]);
      await userEvent.click(screen.getByText('Update'));

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

      await userEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
      const selectComponent = await screen.findByLabelText(
        selectors.components.ValuePicker.select('Add a new mapping')
      );

      await selectOptionInTest(selectComponent, 'Value');

      const input = (await screen.findAllByPlaceholderText('Exact value to match'))[1];

      await userEvent.clear(input);
      await userEvent.type(input, 'New');
      await userEvent.clear(screen.getAllByPlaceholderText('Optional display text')[2]);
      await userEvent.type(screen.getAllByPlaceholderText('Optional display text')[2], 'display');
      await userEvent.click(screen.getByText('Update'));

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
      await userEvent.click(screen.getAllByTestId('remove-value-mapping')[0]);

      await userEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
      const selectComponent = await screen.findByLabelText(
        selectors.components.ValuePicker.select('Add a new mapping')
      );
      await selectOptionInTest(selectComponent, 'Range');

      await userEvent.clear(screen.getByPlaceholderText('Range start'));
      await userEvent.type(screen.getByPlaceholderText('Range start'), '10');

      await userEvent.clear(screen.getByPlaceholderText('Range end'));
      await userEvent.type(screen.getByPlaceholderText('Range end'), '20');

      await userEvent.clear(screen.getByPlaceholderText('Optional display text'));
      await userEvent.type(screen.getByPlaceholderText('Optional display text'), 'display');

      await userEvent.click(screen.getByText('Update'));

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

  describe('When adding and updating regex map', () => {
    it('should add new regex map', async () => {
      const onChangeSpy = jest.fn();
      setup(onChangeSpy, { value: [] });
      await userEvent.click(screen.getAllByTestId('remove-value-mapping')[0]);

      await userEvent.click(screen.getByLabelText(selectors.components.ValuePicker.button('Add a new mapping')));
      const selectComponent = await screen.findByLabelText(
        selectors.components.ValuePicker.select('Add a new mapping')
      );
      await selectOptionInTest(selectComponent, 'Regex');

      await userEvent.clear(screen.getByPlaceholderText('Regular expression'));
      await userEvent.type(screen.getByPlaceholderText('Regular expression'), '(.*).example.com');

      await userEvent.clear(screen.getByPlaceholderText('Optional display text'));
      await userEvent.type(screen.getByPlaceholderText('Optional display text'), '$1');

      await userEvent.click(screen.getByText('Update'));

      expect(onChangeSpy).toBeCalledWith([
        {
          type: MappingType.RegexToText,
          options: {
            pattern: '(.*).example.com',
            result: {
              text: '$1',
              index: 0,
            },
          },
        },
      ]);
    });
  });
});
