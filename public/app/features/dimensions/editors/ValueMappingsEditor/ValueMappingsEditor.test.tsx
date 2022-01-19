import React from 'react';
import { render, screen } from '@testing-library/react';
import { ValueMappingsEditor, Props } from './ValueMappingsEditor';
import { MappingType } from '@grafana/data';

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
});
