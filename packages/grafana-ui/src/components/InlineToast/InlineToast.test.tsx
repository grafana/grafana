import { render, screen } from '@testing-library/react';

import { InlineToast } from './InlineToast';

describe('InlineToast', () => {
  it('renders the content in an alert so it is announced by screen readers', () => {
    render(
      <InlineToast referenceElement={document.body} placement="top">
        Copied!
      </InlineToast>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Copied!');
  });
});
