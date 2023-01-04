import { render, screen } from '@testing-library/react';
import React from 'react';

import { RawPrometheusListItemEmptyValue } from '../utils/getRawPrometheusListItemsFromDataFrame';

import { ItemValues } from './ItemValues';
import { RawListValue } from './RawListItem';

const value1 = 'value 1';
const value2 = 'value 2';

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
      value: RawPrometheusListItemEmptyValue, // Empty value
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
