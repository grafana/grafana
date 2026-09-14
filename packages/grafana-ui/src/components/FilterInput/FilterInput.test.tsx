import { render, screen } from '@testing-library/react';

import { FilterInput } from './FilterInput';

const onChange = jest.fn();

describe('FilterInput', () => {
  it('should show the search icon by default', () => {
    render(<FilterInput value="" onChange={onChange} />);

    expect(screen.getByTestId('icon-search')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-filter')).not.toBeInTheDocument();
  });

  it('should show the filter icon when icon="filter" is passed', () => {
    render(<FilterInput value="" onChange={onChange} icon="filter" />);

    expect(screen.getByTestId('icon-filter')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-search')).not.toBeInTheDocument();
  });

  it('should not forward the icon prop as a raw DOM attribute on the input', () => {
    render(<FilterInput value="" onChange={onChange} icon="filter" />);

    expect(screen.getByRole('textbox')).not.toHaveAttribute('icon');
  });
});
