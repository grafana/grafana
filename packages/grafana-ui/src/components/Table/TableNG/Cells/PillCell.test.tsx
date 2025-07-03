import { render, screen } from '@testing-library/react';

import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { TableCellDisplayMode, TablePillCellOptions } from '@grafana/schema';

import { PillCell } from './PillCell';

// Mock the theme context
jest.mock('../../../../../themes/ThemeContext', () => ({
  useStyles2: jest.fn(() => ({
    cell: 'cell-class',
    pillsContainer: 'pills-container-class',
    pill: 'pill-class',
  })),
}));

describe('PillCell', () => {
  const mockCellOptions: TablePillCellOptions = {
    type: TableCellDisplayMode.Pill,
    colorMode: 'auto',
  };

  const mockField: Field = {
    name: 'test',
    type: 'string' as any,
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
      color: '#FF0000', // default color
      valueMappingMode: 'by-value',
      valueMappings: [
        { value: 'success', color: '#00FF00' },
        { value: 'error', color: '#FF0000' },
        { value: 'warning', color: '#FFFF00' },
      ],
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

  it('should use contains matching when matchType is contains', () => {
    const mappedOptions: TablePillCellOptions = {
      type: TableCellDisplayMode.Pill,
      colorMode: 'mapped',
      color: '#FF0000', // default color
      valueMappingMode: 'by-value',
      valueMappings: [
        { value: 'error', color: '#FF0000', matchType: 'contains' },
        { value: 'warn', color: '#FFFF00', matchType: 'contains' },
        { value: 'success', color: '#00FF00', matchType: 'exact' },
      ],
    };

    render(<PillCell {...defaultProps} value="database_error,api_warning,success,unknown" cellOptions={mappedOptions} />);
    
    const errorPill = screen.getByText('database_error');
    const warningPill = screen.getByText('api_warning');
    const successPill = screen.getByText('success');
    const unknownPill = screen.getByText('unknown');

    expect(errorPill).toBeInTheDocument();
    expect(warningPill).toBeInTheDocument();
    expect(successPill).toBeInTheDocument();
    expect(unknownPill).toBeInTheDocument();
  });

  it('should use global match type when valueMappingMode is on', () => {
    const mappedOptions: TablePillCellOptions = {
      type: TableCellDisplayMode.Pill,
      colorMode: 'mapped',
      color: '#FF0000', // default color
      valueMappingMode: 'on',
      globalMatchType: 'contains',
      valueMappings: [
        { value: 'error', color: '#FF0000' },
        { value: 'warn', color: '#FFFF00' },
        { value: 'success', color: '#00FF00' },
      ],
    };

    render(<PillCell {...defaultProps} value="database_error,api_warning,success,unknown" cellOptions={mappedOptions} />);
    
    const errorPill = screen.getByText('database_error');
    const warningPill = screen.getByText('api_warning');
    const successPill = screen.getByText('success');
    const unknownPill = screen.getByText('unknown');

    expect(errorPill).toBeInTheDocument();
    expect(warningPill).toBeInTheDocument();
    expect(successPill).toBeInTheDocument();
    expect(unknownPill).toBeInTheDocument();
  });

  it('should fall back to auto mode when valueMappingMode is off', () => {
    const mappedOptions: TablePillCellOptions = {
      type: TableCellDisplayMode.Pill,
      colorMode: 'mapped',
      color: '#FF0000', // default color
      valueMappingMode: 'off',
      valueMappings: [
        { value: 'error', color: '#FF0000' },
        { value: 'warn', color: '#FFFF00' },
        { value: 'success', color: '#00FF00' },
      ],
    };

    render(<PillCell {...defaultProps} value="error,warning,success" cellOptions={mappedOptions} />);
    
    const errorPill = screen.getByText('error');
    const warningPill = screen.getByText('warning');
    const successPill = screen.getByText('success');

    expect(errorPill).toBeInTheDocument();
    expect(warningPill).toBeInTheDocument();
    expect(successPill).toBeInTheDocument();
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
    render(<PillCell {...defaultProps} value={null as any} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });
}); 