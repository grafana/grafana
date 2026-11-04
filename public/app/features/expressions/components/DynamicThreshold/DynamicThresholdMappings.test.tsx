import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { DynamicThresholdMappings } from './DynamicThresholdMappings';

describe('DynamicThresholdMappings', () => {
  it('adds and removes explicit mappings without using suggestions as mappings', async () => {
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
    expect(screen.queryByRole('button', { name: /Move mapping row/ })).not.toBeInTheDocument();

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

  it('preserves range threshold positions when the upper bound is entered first and the lower bound is cleared', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    function StatefulMappings() {
      const [mappings, setMappings] = useState<Array<{ labelValue: string; thresholds: Array<number | undefined> }>>([
        { labelValue: 'production', thresholds: [undefined, undefined] },
      ]);
      return (
        <DynamicThresholdMappings
          mappings={mappings}
          labelValues={[]}
          thresholdCount={2}
          errors={[]}
          onChange={(nextMappings) => {
            onChange(nextMappings);
            setMappings(nextMappings);
          }}
        />
      );
    }

    render(<StatefulMappings />);
    await user.type(screen.getByRole('spinbutton', { name: 'Mapping row 1 upper threshold' }), '8');
    expect(onChange).toHaveBeenLastCalledWith([{ labelValue: 'production', thresholds: [undefined, 8] }]);

    await user.type(screen.getByRole('spinbutton', { name: 'Mapping row 1 lower threshold' }), '1');
    await user.clear(screen.getByRole('spinbutton', { name: 'Mapping row 1 lower threshold' }));
    expect(onChange).toHaveBeenLastCalledWith([{ labelValue: 'production', thresholds: [undefined, 8] }]);
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
