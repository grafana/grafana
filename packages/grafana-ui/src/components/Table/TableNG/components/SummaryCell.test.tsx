import { screen, render } from '@testing-library/react';

import { Field, FieldType } from '@grafana/data';

import { SummaryCell } from './SummaryCell';

describe('SummaryCell', () => {
  const rows = [
    { Field1: 1, Field2: 3, Text: 'a', __depth: 0, __index: 0 },
    { Field1: 2, Field2: 10, Text: 'b', __depth: 0, __index: 1 },
    { Field1: 3, Text: 'efghi', __depth: 0, __index: 2 },
  ];

  const footers = [
    {
      reducers: ['sum'],
    },
    {
      reducers: ['sum'],
    },
    {
      reducers: ['sum'],
    },
  ];

  const numericField: Field = {
    name: 'Field1',
    type: FieldType.number,
    values: [1, 2, 3],
    config: {
      custom: {
        footer: {
          reducers: ['sum'],
        },
      },
    },
    display: (value: unknown) => ({
      text: String(value),
      numeric: Number(value),
      color: undefined,
      prefix: undefined,
      suffix: undefined,
    }),
    state: {},
    getLinks: undefined,
  };

  const numericField2: Field = {
    name: 'Field2',
    type: FieldType.number,
    values: [3, 10],
    config: {
      custom: {
        footer: {
          reducers: ['sum'],
        },
      },
    },
    display: (value: unknown) => ({
      text: String(value),
      numeric: Number(value),
      color: undefined,
      prefix: undefined,
      suffix: undefined,
    }),
    state: {},
    getLinks: undefined,
  };

  const textField: Field = {
    name: 'Text',
    type: FieldType.string,
    values: ['a', 'b', 'c'],
    config: {
      custom: {
        reducers: ['sum'],
      },
    },
    display: (value: unknown) => ({
      text: String(value),
      numeric: 0,
      color: undefined,
      prefix: undefined,
      suffix: undefined,
    }),
    state: {},
    getLinks: undefined,
  };

  it('should calculate sum for numeric fields', () => {
    render(<SummaryCell footers={footers} rows={rows} field={numericField} textAlign="left" colIdx={1} />);
    expect(screen.getByText('6')).toBeInTheDocument(); // 1 + 2 + 3
  });

  it('should hide the label for the sum reducer if hideLabel is true', () => {
    render(<SummaryCell footers={footers} rows={rows} field={numericField} textAlign="left" colIdx={1} hideLabel />);
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument(); // 1 + 2 + 3
  });

  it('should show the label for the sum reducer if its not the only reducer', () => {
    const numericFieldWithMultipleReducers = {
      ...numericField,
      config: {
        ...numericField.config,
        custom: { ...numericField.config.custom, footer: { reducers: ['sum', 'mean'] } },
      },
    };
    render(
      <SummaryCell footers={footers} rows={rows} field={numericFieldWithMultipleReducers} textAlign="left" colIdx={1} />
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument(); // 1 + 2 + 3
    expect(screen.getByText('Mean')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // (1 + 2 + 3) / 3
  });

  it('should calculate mean for numeric fields', () => {
    const newNumericField = {
      ...numericField,
      config: {
        ...numericField.config,
        custom: { ...numericField.config.custom, footer: { reducers: ['mean'] } },
      },
    };
    render(<SummaryCell footers={footers} rows={rows} field={newNumericField} textAlign="left" colIdx={1} />);
    expect(screen.getByText('Mean')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // (1 + 2 + 3) / 3
  });

  it('should render an empty summary cell for non-numeric fields with numeric reducers', () => {
    render(<SummaryCell footers={footers} rows={rows} field={textField} textAlign="left" colIdx={1} />);
    expect(screen.getByTestId('summary-cell-empty')).toBeInTheDocument();
  });

  it('should render the summary cell if a non-numeric reducer is set for a non-numeric field', () => {
    const textFieldNonNumericReducer = {
      ...textField,
      config: { ...textField.config, custom: { ...textField.config.custom, footer: { reducers: ['last'] } } },
    };
    render(
      <SummaryCell footers={footers} rows={rows} field={textFieldNonNumericReducer} textAlign="left" colIdx={1} />
    );
    expect(screen.getByText('Last')).toBeInTheDocument();
    expect(screen.getByText('efghi')).toBeInTheDocument();
  });

  it('should render an empty summary cell if no reducers are set', () => {
    const numericFieldNoReducers = {
      ...numericField,
      config: { ...numericField.config, custom: { ...numericField.config.custom, footer: { reducers: [] } } },
    };
    render(<SummaryCell footers={footers} rows={rows} field={numericFieldNoReducers} textAlign="left" colIdx={1} />);
    expect(screen.getByTestId('summary-cell-empty')).toBeInTheDocument();
  });

  it('should correctly calculate sum for numeric fields based on selected fields', () => {
    render(
      <>
        <SummaryCell footers={footers} rows={rows} field={numericField} textAlign="left" colIdx={1} />
        <SummaryCell footers={footers} rows={rows} field={numericField2} textAlign="left" colIdx={1} />
      </>
    );

    expect(screen.getByText('6')).toBeInTheDocument(); // 1 + 2 + 3
    expect(screen.getByText('13')).toBeInTheDocument(); // 3 + 10
  });

  it('should render summary cells with a mix of numeric-and non-numeric reducers and fields', () => {
    const fields = [numericField, numericField2, textField].map((field) => ({
      ...field,
      config: {
        ...field.config,
        custom: {
          ...field.config.custom,
          footer: { reducers: ['sum', 'mean', 'last'] },
        },
      },
    }));
    render(
      <>
        {fields.map((field, index) => (
          <SummaryCell footers={footers} key={index} rows={rows} field={field} textAlign="left" colIdx={1} />
        ))}
      </>
    );
    expect(screen.getByText('13')).toBeInTheDocument(); // sum
    expect(screen.getByText('6.5')).toBeInTheDocument(); // mean
    expect(screen.getByText('efghi')).toBeInTheDocument(); // last
  });
});
