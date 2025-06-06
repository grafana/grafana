import { render, screen, within } from '@testing-library/react';

import { FieldType, FormattedValue, toDataFrame } from '@grafana/data';

import RawListContainer, { RawListContainerProps } from './RawListContainer';

function getList(): HTMLElement {
  return screen.getByRole('table');
}

const display = (input: string): FormattedValue => {
  return {
    text: input,
  };
};

const dataFrame = toDataFrame({
  name: 'A',
  fields: [
    {
      name: 'Time',
      type: FieldType.time,
      values: [1609459200000, 1609470000000, 1609462800000, 1609466400000],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
    {
      display: display,
      name: 'text',
      type: FieldType.string,
      values: ['test_string_1', 'test_string_2', 'test_string_3', 'test_string_4'],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
    {
      name: '__name__',
      type: FieldType.string,
      values: ['test_string_1', 'test_string_2', 'test_string_3', 'test_string_4'],
      config: {
        custom: {
          filterable: false,
        },
      },
    },
  ],
});

const defaultProps: RawListContainerProps = {
  tableResult: dataFrame,
};

describe('RawListContainer', () => {
  it('should render', () => {
    render(<RawListContainer {...defaultProps} />);

    expect(getList()).toBeInTheDocument();
    const rows = within(getList()).getAllByRole('row');
    expect(rows).toHaveLength(4);
    rows.forEach((row, index) => {
      expect(screen.getAllByText(`test_string_${index + 1}`)[0]).toBeVisible();
    });
  });
});
