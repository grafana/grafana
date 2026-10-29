import { render, screen } from 'test/test-utils';

import { FilterSidebar } from './FilterSidebar';
import { type TokenDefinition } from './tokens';

function definition(key: string, label: string): TokenDefinition {
  return {
    key,
    label: () => label,
    description: () => `${label} description`,
    example: `${key}:value`,
  };
}

describe('FilterSidebar', () => {
  it('shows one labelled field per definition, in the order of the definitions, each with its own control, and no field for an unlisted control', () => {
    render(
      <FilterSidebar
        definitions={[definition('beta', 'Second field'), definition('alpha', 'First field')]}
        controls={{
          alpha: { render: () => <input aria-label="alpha control" /> },
          beta: { render: () => <input aria-label="beta control" /> },
          unlisted: { render: () => <input aria-label="unlisted control" /> },
        }}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    const groups = screen.getAllByRole('group');

    expect(groups.map((group) => group.querySelector('label')?.textContent)).toEqual(['Second field', 'First field']);
    expect(groups[0]).toContainElement(screen.getByRole('textbox', { name: 'beta control' }));
    expect(groups[1]).toContainElement(screen.getByRole('textbox', { name: 'alpha control' }));
    expect(screen.queryByRole('textbox', { name: 'unlisted control' })).not.toBeInTheDocument();
  });

  it('names a control through its label when the control cannot take an aria-label', () => {
    render(
      <FilterSidebar
        definitions={[definition('alpha', 'First field')]}
        controls={{ alpha: { controlId: 'alpha-id', render: () => <input id="alpha-id" /> } }}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByRole('textbox', { name: 'First field' })).toBeInTheDocument();
  });
});
