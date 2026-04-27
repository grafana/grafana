import { render, screen } from '@testing-library/react';

import { FieldType, toDataFrame } from '@grafana/data/dataframe';
import {
  GroupByOperationID,
  type GroupToNestedTableTransformerOptions,
  type GroupToNestedTableTransformerOptionsV2,
} from '@grafana/data/internal';
import { FieldMatcherID } from '@grafana/data/transformations';
import { config } from '@grafana/runtime';

import { GroupToNestedTableTransformerEditor } from './Editor';

const input = [
  toDataFrame({
    fields: [
      { name: 'message', type: FieldType.string, values: ['one', 'two'] },
      { name: 'values', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

describe('GroupToNestedTableTransformerEditor routing', () => {
  let originalFeatureToggles: typeof config.featureToggles;

  beforeEach(() => {
    originalFeatureToggles = config.featureToggles;
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('renders the V2 editor when options are already in V2 shape (regardless of toggle)', () => {
    config.featureToggles = { ...originalFeatureToggles, groupToNestedTableV2: false };
    const options: GroupToNestedTableTransformerOptionsV2 = {
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: 'message' },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    // "Add rule" button is V2-only
    expect(screen.getByRole('button', { name: 'Add rule' })).toBeInTheDocument();
  });

  it('renders the V1 editor when toggle is off and options are V1 shape', () => {
    config.featureToggles = { ...originalFeatureToggles, groupToNestedTableV2: false };
    const options: GroupToNestedTableTransformerOptions = { fields: {} };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    // V1 editor lists field names as inline labels; no "Add rule" button
    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add rule' })).not.toBeInTheDocument();
  });

  it('renders the V2 editor when the toggle is on, even with V1-shaped options', () => {
    config.featureToggles = { ...originalFeatureToggles, groupToNestedTableV2: true };
    const options: GroupToNestedTableTransformerOptions = { fields: {} };

    render(<GroupToNestedTableTransformerEditor input={input} options={options} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Add rule' })).toBeInTheDocument();
  });
});
