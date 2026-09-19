import { render, screen, within } from '@testing-library/react';

import { type CustomTransformOperator, type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { SystemTransformationList } from './systemTransformationDisplay';

// Both transformation editors render through this component, so what it guarantees — the grouping
// label, the row test id, one row per transformation in order — is what stops them describing the
// same plugin transformations differently.

function renderList(
  transformations: Array<DataTransformerConfig | CustomTransformOperator>,
  position: 'prepend' | 'append' = 'prepend'
) {
  return render(
    <SystemTransformationList
      transformations={transformations}
      position={position}
      className="list"
      itemClassName="row"
      nameClassName="name"
      leading={<span data-testid="leading" />}
      trailing={<span data-testid="trailing" />}
    />
  );
}

describe('SystemTransformationList', () => {
  beforeAll(() => {
    standardTransformersRegistry.setInit(getStandardTransformers);
  });

  it('renders nothing when the plugin contributed no transformations', () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one row per transformation, in pipeline order, named from the registry', () => {
    renderList([
      { id: 'reduce', options: {} },
      { id: 'limit', options: {} },
    ]);

    const rows = screen.getAllByTestId(selectors.components.Transforms.systemTransformationRow);

    expect(rows.map((row) => row.textContent)).toEqual(['Reduce', 'Limit']);
  });

  it('names a transformation the registry does not know by its id', () => {
    renderList([{ id: 'not-a-registered-transformation', options: {} }]);

    expect(screen.getByText('not-a-registered-transformation')).toBeInTheDocument();
  });

  it('names a custom operator generically, since it carries no id', () => {
    renderList([jest.fn()]);

    expect(screen.getByText('Custom transformation (code defined)')).toBeInTheDocument();
  });

  it('gives each row the leading and trailing affordances the editor supplied', () => {
    renderList([{ id: 'reduce', options: {} }, jest.fn()]);

    for (const row of screen.getAllByTestId(selectors.components.Transforms.systemTransformationRow)) {
      expect(within(row).getByTestId('leading')).toBeInTheDocument();
      expect(within(row).getByTestId('trailing')).toBeInTheDocument();
    }
  });

  it.each([
    ['prepend', 'Panel transformations, applied before your transformations'],
    ['append', 'Panel transformations, applied after your transformations'],
  ] as const)('groups %s rows under a label saying when they run', (position, label) => {
    renderList([{ id: 'reduce', options: {} }], position);

    // Placement above or below the editable rows is the only cue a sighted user gets, so the group
    // label has to say it in words.
    expect(screen.getByRole('list', { name: label })).toBeInTheDocument();
  });
});
