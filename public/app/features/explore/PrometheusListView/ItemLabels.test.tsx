import { render, screen } from '@testing-library/react';
import React from 'react';

import { ItemValues } from './ItemValues';
import { RawListValue } from './RawListItem';

function getMockString(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const value1 = getMockString(8);
const value2 = getMockString(8);

const defaultProps: {
  totalNumberOfValues: number;
  values: RawListValue[];
  hideFieldsWithoutValues: boolean;
} = {
  totalNumberOfValues: 3,
  values: [
    {
      key: 'Value #A',
      value: value1,
    },
    {
      key: 'Value #B',
      value: value2,
    },
    {
      key: 'Value #C',
      value: ' ', // Empty value
    },
  ],
  hideFieldsWithoutValues: false,
};

describe('ItemValues', () => {
  it('should render values, with empty values', () => {
    const itemValues = render(<ItemValues {...defaultProps} />);
    expect(screen.getByText(value1)).toBeVisible();
    expect(screen.getByText(value2)).toBeVisible();
    expect(itemValues?.baseElement?.children?.item(0)?.children?.item(0)?.children.length).toBe(3);
  });

  it('should render values, without empty values', () => {
    const props = { ...defaultProps, hideFieldsWithoutValues: true };
    const itemValues = render(<ItemValues {...props} />);
    expect(screen.getByText(value1)).toBeVisible();
    expect(screen.getByText(value2)).toBeVisible();
    expect(itemValues?.baseElement?.children?.item(0)?.children?.item(0)?.children.length).toBe(2);
  });
});
