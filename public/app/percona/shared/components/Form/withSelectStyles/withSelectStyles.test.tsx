import { render, screen } from '@testing-library/react';

import { withSelectStyles } from './withSelectStyles';

const FooWrapper = () => <div data-testid="foo-wrapper" />;

describe('withSelectStyles', () => {
  it('should return component with injected className', () => {
    const Foo = withSelectStyles(FooWrapper);
    render(<Foo />);

    expect(screen.getByTestId('foo-wrapper').className).toBeDefined();
  });
});
