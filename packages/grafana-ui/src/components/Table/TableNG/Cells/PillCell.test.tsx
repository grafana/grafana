import { render, screen } from '@testing-library/react';

import { DataFrame, Field, FieldType, GrafanaTheme2, MappingType, createTheme } from '@grafana/data';
import { TableCellDisplayMode, TablePillCellOptions } from '@grafana/schema';

import { mockThemeContext } from '../../../../themes/ThemeContext';

import { PillCell } from './PillCell';

describe('PillCell', () => {
  let restoreThemeContext: () => void;

  beforeEach(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterEach(() => {
    restoreThemeContext();
  });

  const mockCellOptions: TablePillCellOptions = {
    type: TableCellDisplayMode.Pill,
    colorMode: 'auto',
  };

  const mockField: Field = {
    name: 'test',
    type: FieldType.string,
    values: [],
    config: {},
  };

  const mockFrame: DataFrame = {
    name: 'test',
    fields: [mockField],
    length: 1,
  };

  const defaultProps = {
    value: 'test-value',
    field: mockField,
    justifyContent: 'flex-start' as const,
    cellOptions: mockCellOptions,
    rowIdx: 0,
    frame: mockFrame,
    height: 30,
    width: 100,
    theme: {} as GrafanaTheme2,
    cellInspect: false,
    showFilters: false,
  };

  it('should render pills for single values', () => {
    render(<PillCell {...defaultProps} />);
    expect(screen.getByText('test-value')).toBeInTheDocument();
  });

  it('should render pills for CSV values', () => {
    render(<PillCell {...defaultProps} value="value1,value2,value3" />);
    expect(screen.getByText('value1')).toBeInTheDocument();
    expect(screen.getByText('value2')).toBeInTheDocument();
    expect(screen.getByText('value3')).toBeInTheDocument();
  });

  it('should render pills for JSON array values', () => {
    render(<PillCell {...defaultProps} value='["item1","item2","item3"]' />);
    expect(screen.getByText('item1')).toBeInTheDocument();
    expect(screen.getByText('item2')).toBeInTheDocument();
    expect(screen.getByText('item3')).toBeInTheDocument();
  });

  it('should use mapped colors when colorMode is mapped', () => {
    const mappedOptions: TablePillCellOptions = {
      type: TableCellDisplayMode.Pill,
      colorMode: 'mapped',
    };

    render(<PillCell {...defaultProps} value="success,error,warning,unknown" cellOptions={mappedOptions} />);

    const successPill = screen.getByText('success');
    const errorPill = screen.getByText('error');
    const warningPill = screen.getByText('warning');
    const unknownPill = screen.getByText('unknown');

    expect(successPill).toBeInTheDocument();
    expect(errorPill).toBeInTheDocument();
    expect(warningPill).toBeInTheDocument();
    expect(unknownPill).toBeInTheDocument();
  });

  it('should use field-level value mappings when available', () => {
    const mappedOptions: TablePillCellOptions = {
      type: TableCellDisplayMode.Pill,
      colorMode: 'mapped',
    };

    // Mock field with value mappings
    const fieldWithMappings: Field = {
      ...mockField,
      config: {
        ...mockField.config,
        mappings: [
          {
            type: MappingType.ValueToText,
            options: {
              'success': { color: '#00FF00' },
              'error': { color: '#FF0000' },
              'warning': { color: '#FFFF00' },
            },
          },
        ],
      },
      display: (value: unknown) => ({
        text: String(value),
        color: String(value) === 'success' ? '#00FF00' : String(value) === 'error' ? '#FF0000' : String(value) === 'warning' ? '#FFFF00' : '#FF780A',
        numeric: 0,
      }),
    };

    render(
      <PillCell 
        {...defaultProps} 
        value="success,error,warning,unknown" 
        cellOptions={mappedOptions}
        field={fieldWithMappings}
      />
    );
    
    const successPill = screen.getByText('success');
    const errorPill = screen.getByText('error');
    const warningPill = screen.getByText('warning');
    const unknownPill = screen.getByText('unknown');

    expect(successPill).toBeInTheDocument();
    expect(errorPill).toBeInTheDocument();
    expect(warningPill).toBeInTheDocument();
    expect(unknownPill).toBeInTheDocument();
  });

  it('should use fixed color when colorMode is fixed', () => {
    const fixedOptions: TablePillCellOptions = {
      type: TableCellDisplayMode.Pill,
      colorMode: 'fixed',
      color: '#FF00FF',
    };

    render(<PillCell {...defaultProps} cellOptions={fixedOptions} />);
    expect(screen.getByText('test-value')).toBeInTheDocument();
  });

  it('should use auto color when colorMode is auto', () => {
    const autoOptions: TablePillCellOptions = {
      type: TableCellDisplayMode.Pill,
      colorMode: 'auto',
    };

    render(<PillCell {...defaultProps} cellOptions={autoOptions} />);
    expect(screen.getByText('test-value')).toBeInTheDocument();
  });

  it('should show dash for empty values', () => {
    render(<PillCell {...defaultProps} value="" />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should show dash for null values', () => {
    render(<PillCell {...defaultProps} value={null as unknown as string} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
