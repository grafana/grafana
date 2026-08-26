import { render, screen } from 'test/test-utils';

import { FieldType, toDataFrame } from '@grafana/data';
import { type ScalarDimensionConfig } from '@grafana/schema';
import { mockComboboxRect } from '@grafana/test-utils';
import { Field } from '@grafana/ui';

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
  it('uses the parent field label as the combobox accessible name', () => {
    const { props } = makeProps({ min: 0, max: 360, fixed: 15 });
    render(
      <Field label="Rotation angle">
        <ScalarDimensionEditor {...props} />
      </Field>
    );

    expect(screen.getByRole('combobox', { name: 'Rotation angle' })).toBeInTheDocument();
  });

  it('falls back to a Scalar name when no id is provided', () => {
    const { props } = makeProps({ min: 0, max: 360, fixed: 15 });
    render(<ScalarDimensionEditor {...props} id={undefined} />);

    expect(screen.getByRole('combobox', { name: 'Scalar' })).toBeInTheDocument();
  });
});
