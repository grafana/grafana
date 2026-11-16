import { render, screen } from 'test/test-utils';

import { FieldType, toDataFrame } from '@grafana/data';
import { type ScalarDimensionConfig } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';

import { type ScalarDimensionOptions } from '../types';

import { ScalarDimensionEditor } from './ScalarDimensionEditor';
import { makePropsFactory } from './test-utils';

const makeProps = makePropsFactory<ScalarDimensionConfig, ScalarDimensionOptions>(
  'rotation',
  { min: 0, max: 360 },
  {
    data: [toDataFrame({ fields: [{ name: 'temp', type: FieldType.number, values: [1, 2, 3] }] })],
  }
);

beforeEach(() => mockComboboxRect());

describe('ScalarDimensionEditor', () => {
  it('labels the field combobox with an inline Field row', () => {
    const { props } = makeProps({ min: 0, max: 360, fixed: 15 });
    render(<ScalarDimensionEditor {...props} />);

    expect(screen.getByRole('combobox', { name: 'Field' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mod' })).toBeChecked();
    expect(screen.getByLabelText('Value')).toHaveValue(15);
  });

  it('hides the fixed value input when a field is selected', () => {
    const { props } = makeProps({ min: 0, max: 360, field: 'temp', fixed: 15 });
    render(<ScalarDimensionEditor {...props} />);

    expect(screen.getByRole('combobox', { name: 'Field' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
  });
});
