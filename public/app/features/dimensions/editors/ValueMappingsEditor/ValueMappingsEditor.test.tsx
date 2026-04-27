import { render, screen } from '@testing-library/react';

import type { StandardEditorsRegistryItem } from '@grafana/data/field';
import { MappingType } from '@grafana/data/types';

import { ValueMappingsEditor, type Props } from './ValueMappingsEditor';

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    onChange: jest.fn(),
    value: [
      {
        type: MappingType.ValueToText,
        options: {
          '20': { text: 'Ok' },
        },
      },
      {
        type: MappingType.RangeToText,
        options: {
          from: 21,
          to: 30,
          result: { text: 'Meh' },
        },
      },
    ],
    item: {} as StandardEditorsRegistryItem,
    context: {
      data: [],
    },
  };

  Object.assign(props, propOverrides);

  render(<ValueMappingsEditor {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    setup();
    const button = screen.getByText('Edit value mappings');
    expect(button).toBeInTheDocument();
  });

  it('should render icon picker when icon exists and icon setting is set to true', () => {
    const propOverrides: Partial<Props> = {
      item: { settings: { icon: true } } as StandardEditorsRegistryItem,
      value: [
        {
          type: MappingType.ValueToText,
          options: {
            '20': { text: 'Ok', icon: 'test' },
          },
        },
      ],
    };
    setup(propOverrides);

    const iconPicker = screen.getByTestId('iconPicker');

    expect(iconPicker).toBeInTheDocument();
  });
});
