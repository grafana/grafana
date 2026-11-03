import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DynamicThresholdMappings } from './DynamicThresholdMappings';

describe('DynamicThresholdMappings', () => {
  it('adds, removes, and reorders explicit mappings without using suggestions as mappings', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const mappings = [
      { labelValue: 'production', thresholds: [2] },
      { labelValue: 'staging', thresholds: [3] },
    ];
    const { rerender } = render(
      <DynamicThresholdMappings
        mappings={mappings}
        labelValues={['production', 'staging', 'preview-only']}
        thresholdCount={1}
        errors={[]}
        onChange={onChange}
      />
    );

    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Move mapping row 1 down' }));
    expect(onChange).toHaveBeenLastCalledWith([mappings[1], mappings[0]]);

    await user.click(screen.getByRole('button', { name: 'Remove mapping row 1' }));
    expect(onChange).toHaveBeenLastCalledWith([mappings[1]]);

    await user.click(screen.getByRole('button', { name: 'Add mapping' }));
    expect(onChange).toHaveBeenLastCalledWith([...mappings, { labelValue: '', thresholds: [] }]);

    rerender(
      <DynamicThresholdMappings
        mappings={mappings}
        labelValues={['production', 'staging', 'preview-only']}
        thresholdCount={2}
        errors={[]}
        onChange={onChange}
      />
    );
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
  });

  it('accepts a custom label value that was not discovered in the preview', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <DynamicThresholdMappings
        mappings={[{ labelValue: '', thresholds: [1] }]}
        labelValues={['discovered']}
        thresholdCount={1}
        errors={[]}
        onChange={onChange}
      />
    );

    const labelValue = screen.getByRole('combobox', { name: 'Mapping row 1 label value' });
    await user.type(labelValue, 'custom-value');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith([{ labelValue: 'custom-value', thresholds: [1] }]);
  });

  it('renders discovered suggestions without persisting them', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <DynamicThresholdMappings
        mappings={[{ labelValue: 'production', thresholds: [1] }]}
        labelValues={['production', 'preview-only']}
        thresholdCount={1}
        errors={[]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Mapping row 1 label value' }));
    expect(screen.getByText('preview-only')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves range threshold positions when lower is cleared and upper is entered first', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <DynamicThresholdMappings
        mappings={[{ labelValue: 'production', thresholds: [1, 2] }]}
        labelValues={[]}
        thresholdCount={2}
        errors={[]}
        onChange={onChange}
      />
    );

    await user.clear(screen.getByRole('spinbutton', { name: 'Mapping row 1 lower threshold' }));
    expect(onChange).toHaveBeenLastCalledWith([{ labelValue: 'production', thresholds: [undefined, 2] }]);

    const upper = screen.getByRole('spinbutton', { name: 'Mapping row 1 upper threshold' });
    fireEvent.change(upper, { target: { value: '' } });
    fireEvent.change(upper, { target: { value: '8' } });
    expect(onChange).toHaveBeenLastCalledWith([{ labelValue: 'production', thresholds: [1, 8] }]);
  });

  it('moves a mapping up with its row-specific control', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const mappings = [
      { labelValue: 'production', thresholds: [2] },
      { labelValue: 'staging', thresholds: [3] },
    ];
    render(
      <DynamicThresholdMappings
        mappings={mappings}
        labelValues={[]}
        thresholdCount={1}
        errors={[]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Move mapping row 2 up' }));
    expect(onChange).toHaveBeenCalledWith([mappings[1], mappings[0]]);
  });

  it('places structured mapping validation on the affected row and renders multiple errors', () => {
    render(
      <DynamicThresholdMappings
        mappings={[{ labelValue: 'production', thresholds: [] }]}
        labelValues={[]}
        thresholdCount={1}
        errors={[
          {
            code: 'blankMapping',
            message: 'Mapping row 1 requires a label value.',
            location: { field: 'mappings', mappingIndex: 0 },
          },
          {
            code: 'thresholdArity',
            message: 'Mapping row 1 requires one threshold value.',
            location: { field: 'mappings', mappingIndex: 0 },
          },
        ]}
        onChange={jest.fn()}
      />
    );

    expect(
      screen.getByText('Mapping row 1 requires a label value. Mapping row 1 requires one threshold value.')
    ).toBeInTheDocument();
  });
});
