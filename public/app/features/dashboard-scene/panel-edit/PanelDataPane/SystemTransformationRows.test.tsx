import { render, screen, within } from '@testing-library/react';

import { type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { SystemTransformationRows } from './SystemTransformationRows';

// Naming, ordering and the group label belong to SystemTransformationList and are covered by
// systemTransformationDisplay.test.tsx, which renders it with placeholder affordances. What is only
// true here is which affordances this editor supplies, and that an empty list adds no wrapper.

const transformations: DataTransformerConfig[] = [
  { id: 'reduce', options: {} },
  { id: 'organize', options: {} },
];

describe('SystemTransformationRows', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

  it('marks every row read-only with a lock icon and a System badge', () => {
    render(<SystemTransformationRows transformations={transformations} position="prepend" />);

    const rows = screen.getAllByTestId(selectors.components.Transforms.systemTransformationRow);
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByTestId('icon-lock')).toBeInTheDocument();
    expect(within(rows[0]).getByText('System')).toBeInTheDocument();
    expect(within(rows[1]).getByTestId('icon-lock')).toBeInTheDocument();
    expect(within(rows[1]).getByText('System')).toBeInTheDocument();
  });

  it('renders nothing when the plugin contributed no transformations', () => {
    const { container } = render(<SystemTransformationRows transformations={[]} position="prepend" />);

    expect(container).toBeEmptyDOMElement();
  });
});
