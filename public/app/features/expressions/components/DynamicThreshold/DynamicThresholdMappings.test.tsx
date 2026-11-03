import { render, screen } from '@testing-library/react';
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
    await user.click(screen.getAllByRole('button', { name: 'Move mapping down' })[0]);
    expect(onChange).toHaveBeenLastCalledWith([mappings[1], mappings[0]]);

    await user.click(screen.getAllByRole('button', { name: 'Remove mapping' })[0]);
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

    const labelValue = screen.getByRole('combobox', { name: 'Label value' });
    await user.type(labelValue, 'custom-value');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith([{ labelValue: 'custom-value', thresholds: [1] }]);
  });

  it('places structured mapping validation on the affected row', () => {
    render(
      <DynamicThresholdMappings
        mappings={[{ labelValue: 'production', thresholds: [] }]}
        labelValues={[]}
        thresholdCount={1}
        errors={[
          {
            code: 'thresholdArity',
            message: 'Mapping row 1 requires one threshold value.',
            location: { field: 'mappings', mappingIndex: 0 },
          },
        ]}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText('Mapping row 1 requires one threshold value.')).toBeInTheDocument();
  });
});
