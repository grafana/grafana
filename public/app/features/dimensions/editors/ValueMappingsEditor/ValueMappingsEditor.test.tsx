import { render, screen } from '@testing-library/react';
import React from 'react';

import { MappingType } from '@grafana/data';

import { ValueMappingsEditor, Props } from './ValueMappingsEditor';

const setup = (spy?: any, propOverrides?: object) => {
  const props: Props = {
    onChange: (mappings: any) => {
      if (spy) {
        spy(mappings);
      }
    },
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
    item: {} as any,
    context: {} as any,
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
    const propOverrides = {
      item: { settings: { icon: true } },
      value: [
        {
          type: MappingType.ValueToText,
          options: {
            '20': { text: 'Ok', icon: 'test' },
          },
        },
      ],
    };
    setup({}, propOverrides);

    const iconPicker = screen.getByTestId('iconPicker');

    expect(iconPicker).toBeInTheDocument();
  });
});
