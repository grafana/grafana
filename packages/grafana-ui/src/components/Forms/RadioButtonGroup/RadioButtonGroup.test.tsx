import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { RadioButtonGroup } from './RadioButtonGroup';

describe('RadioButtonGroup', () => {
  it('exposes the RadioGroup container data-testid', () => {
    render(
      <RadioButtonGroup
        options={[
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ]}
        value="a"
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId(selectors.components.RadioGroup.container)).toBeInTheDocument();
  });
});
