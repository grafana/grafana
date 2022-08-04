import { render, screen } from '@testing-library/react';
import React from 'react';

import { PageToolbar } from '..';

describe('PageToolbar', () => {
  it('renders left items when title is not set', () => {
    const testId = 'left-item';
    render(
      <PageToolbar
        leftItems={[
          <div key="left-item" data-testid={testId}>
            Left Item!
          </div>,
        ]}
      />
    );

    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
});
