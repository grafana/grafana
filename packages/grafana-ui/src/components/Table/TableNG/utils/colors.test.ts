import { createTheme, FieldType, type DisplayValue, type Field } from '@grafana/data';
import { TableCellBackgroundDisplayMode } from '@grafana/schema';

import { TableCellDisplayMode } from '../../types';

import { getAlignmentFactor, getApplyToRowBgFn, getCellColorInlineStylesFactory } from './colors';

describe('getApplyToRowBgFn', () => {
  const theme = createTheme();

  const makeColorBackgroundField = (color: string, applyToRow: boolean): Field => ({
    name: color,
    type: FieldType.number,
    values: [1],
    config: {
      custom: {
        cellOptions: {
          type: TableCellDisplayMode.ColorBackground,
          mode: TableCellBackgroundDisplayMode.Basic,
          applyToRow,
        },
      },
    },
    display: () => ({ text: '1', numeric: 1, color }),
  });

  it('returns undefined when no field has applyToRow enabled', () => {
    const fields = [makeColorBackgroundField('#ff0000', false), makeColorBackgroundField('#0000ff', false)];
    const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
    expect(getApplyToRowBgFn(fields, getCellColorInlineStyles)).toBeUndefined();
  });

  it('uses the color of the first (leftmost) field with applyToRow enabled', () => {
    const fields = [makeColorBackgroundField('#ff0000', true), makeColorBackgroundField('#0000ff', true)];
    const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
    const rowBgFn = getApplyToRowBgFn(fields, getCellColorInlineStyles);
    expect(rowBgFn?.(0).background).toBe('#ff0000');
  });

  it('skips fields without applyToRow when picking the winning field', () => {
    const fields = [makeColorBackgroundField('#ff0000', false), makeColorBackgroundField('#0000ff', true)];
    const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
    const rowBgFn = getApplyToRowBgFn(fields, getCellColorInlineStyles);
    expect(rowBgFn?.(0).background).toBe('#0000ff');
  });
});

describe('getAlignmentFactor', () => {
  it('should create a new alignment factor when none exists', () => {
    // Create a field with no existing alignment factor
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      // No state property initially
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value
    const displayValue: DisplayValue = { text: '1', numeric: 1 };

    // Call getAlignmentFactor with the first row
    const result = getAlignmentFactor(field, displayValue, 0);

    // Verify the result has the text property
    expect(result).toEqual(expect.objectContaining({ text: '1' }));

    // Verify that field.state was created and contains the alignment factor
    expect(field.state).toBeDefined();
    expect(field.state?.alignmentFactors).toBeDefined();
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '1' }));
  });

  it('should update alignment factor when a longer value is found', () => {
    // Create a field with an existing alignment factor
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      state: { alignmentFactors: { text: '1' } },
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value that is longer than the existing alignment factor
    const displayValue: DisplayValue = { text: '4444', numeric: 4444 };

    // Call getAlignmentFactor
    const result = getAlignmentFactor(field, displayValue, 3);

    // Verify the result is updated to the longer value
    expect(result).toEqual(expect.objectContaining({ text: '4444' }));

    // Verify that field.state.alignmentFactors was updated
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '4444' }));
  });

  it('should not update alignment factor when a shorter value is found', () => {
    // Create a field with an existing alignment factor for a long value
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      state: { alignmentFactors: { text: '4444' } },
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value that is shorter than the existing alignment factor
    const displayValue: DisplayValue = { text: '1', numeric: 1 };

    // Call getAlignmentFactor
    const result = getAlignmentFactor(field, displayValue, 0);

    // Verify the result is still the longer value
    expect(result).toEqual(expect.objectContaining({ text: '4444' }));

    // Verify that field.state.alignmentFactors was not changed
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '4444' }));
  });

  it('should add alignment factor to existing field state', () => {
    // Create a field with existing state but no alignment factors yet
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      // Field has state but no alignmentFactors
      state: {
        // Use a valid property for FieldState
        // For example, if calcs is a valid property:
        calcs: { sum: 4460 },
        // Or if noValue is a valid property:
        // noValue: true
      },
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value
    const displayValue: DisplayValue = { text: '1', numeric: 1 };

    // Call getAlignmentFactor with the first row
    const result = getAlignmentFactor(field, displayValue, 0);

    // Verify the result has the text property
    expect(result).toEqual(expect.objectContaining({ text: '1' }));

    // Verify that field.state was preserved and alignment factor was added
    expect(field.state).toBeDefined();
    // Check for the valid property we used
    expect(field.state?.calcs).toBeDefined();
    expect(field.state?.alignmentFactors).toBeDefined();
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '1' }));
  });

  it.todo('alignmentFactor.text = displayValue.text;');
});
