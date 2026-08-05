import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataTransformerID, FieldMatcherID, FieldType, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { GroupByOperationID } from '@grafana/data/internal';
import { type TableOptions } from '@grafana/schema';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { getPanelProps } from '../test-utils';

import { createEphemeralGroupTransformation, TablePanel } from './TablePanel';

standardTransformersRegistry.setInit(getStandardTransformers);

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  TableNG: ({
    data,
    onGroupByColumn,
    groupedFieldName,
    onUngroup,
  }: {
    data: {
      fields: Array<{
        display?: (value: unknown) => { text?: string };
        type: FieldType;
        values: Array<Array<{ fields: Array<{ display?: (value: unknown) => unknown; values: unknown[] }> }>>;
      }>;
    };
    onGroupByColumn?: (fieldName: string) => void;
    groupedFieldName?: string;
    onUngroup?: () => void;
  }) => {
    const nestedFrame = data.fields.find((field) => field.type === FieldType.nestedFrames)?.values[0]?.[0];
    const firstNestedField = nestedFrame?.fields[0];
    return (
      <div>
        <button
          data-testid="table-ng"
          data-first-field-display={typeof data.fields[0]?.display}
          data-last-field-type={data.fields.at(-1)?.type}
          data-nested-field-count={nestedFrame?.fields.length}
          data-first-nested-value={String(firstNestedField?.values[0])}
          data-first-nested-display={typeof firstNestedField?.display}
          data-grouped-field-name={groupedFieldName}
          onClick={() => onGroupByColumn?.('Category')}
        >
          Group
        </button>
        {onUngroup && <button onClick={onUngroup}>Ungroup</button>}
      </div>
    );
  },
}));

describe('createEphemeralGroupTransformation', () => {
  it('groups the selected field by display name without persisting panel options', () => {
    expect(createEphemeralGroupTransformation('Category')).toEqual({
      id: DataTransformerID.groupToNestedTable,
      options: {
        rules: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'Category' },
            operation: GroupByOperationID.groupBy,
            aggregations: [],
          },
        ],
      },
    });
  });
});

describe('TablePanel ephemeral grouping', () => {
  it('applies field display processors to the grouped frame', async () => {
    const user = userEvent.setup();
    const props = getPanelProps<TableOptions>(
      { frameIndex: 0, showHeader: true },
      { fieldConfig: { defaults: {}, overrides: [] } }
    );
    const frame = toDataFrame({
      fields: [
        { name: 'Category', values: ['Hardware', 'Hardware', 'Software'] },
        { name: 'Sales', values: [10, 20, 30] },
      ],
    });

    render(<TablePanel {...props} data={{ ...props.data, series: [frame] }} />);
    await user.click(screen.getByRole('button', { name: 'Group' }));

    await waitFor(() => {
      expect(screen.getByTestId('table-ng')).toHaveAttribute('data-first-field-display', 'function');
      expect(screen.getByTestId('table-ng')).toHaveAttribute('data-last-field-type', FieldType.nestedFrames);
      expect(screen.getByTestId('table-ng')).toHaveAttribute('data-nested-field-count', '1');
      expect(screen.getByTestId('table-ng')).toHaveAttribute('data-first-nested-value', '10');
      expect(screen.getByTestId('table-ng')).toHaveAttribute('data-first-nested-display', 'function');
      expect(screen.getByTestId('table-ng')).toHaveAttribute('data-grouped-field-name', 'Category');
    });

    await user.click(screen.getByRole('button', { name: 'Ungroup' }));
    await waitFor(() => {
      expect(screen.getByTestId('table-ng')).not.toHaveAttribute('data-last-field-type', FieldType.nestedFrames);
      expect(screen.queryByRole('button', { name: 'Ungroup' })).not.toBeInTheDocument();
    });
  });
});
