import { render } from '@testing-library/react';
import React from 'react';

import { getMockString } from './ItemValues.test';
import { RawListValue } from './RawListItem';
import RawListItemAttributes from './RawListItemAttributes';

const getDefaultProps = (
  override: Partial<{
    value: RawListValue;
    index: number;
    length: number;
    isExpandedView: boolean;
  }>
) => {
  const key = getMockString(8);
  const value = getMockString(12);

  return {
    value: {
      key: key,
      value: value,
    },
    index: 0,
    length: 0,
    isExpandedView: false,
    ...override,
  };
};

describe('RawListItemAttributes', () => {
  it('should render collapsed', () => {
    const props = getDefaultProps({ isExpandedView: false });
    const attributeRow = render(<RawListItemAttributes {...props} />);

    expect(attributeRow.getByText(props.value.value)).toBeVisible();
    expect(attributeRow.getByText(props.value.key)).toBeVisible();
    expect(attributeRow.baseElement.textContent).toEqual(`${props.value.key}="${props.value.value}"`);
  });

  it('should render expanded', () => {
    const props = getDefaultProps({ isExpandedView: true });
    const attributeRow = render(<RawListItemAttributes {...props} />);

    expect(attributeRow.getByText(props.value.value)).toBeVisible();
    expect(attributeRow.getByText(props.value.key)).toBeVisible();
    expect(attributeRow.baseElement.textContent).toEqual(`${props.value.key}="${props.value.value}"`);
  });
});
