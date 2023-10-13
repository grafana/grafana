import { render } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';
import { ThemeSpacingTokens } from '@grafana/data';
import { ResponsiveProp } from '@grafana/ui/src/components/Layout/utils/responsiveness';

import { Indent } from './Indent';

describe('Indent component', () => {
  it('should apply spacing and level', () => {
    const spacing: ResponsiveProp<ThemeSpacingTokens> = { xs: 2, sm: 4 };
    const level = 3;

    const { getByText } = render(
      <Indent spacing={spacing} level={level}>
        Custom Content
      </Indent>
    );

    const indentor = getByText('Custom Content');
    expect(indentor).toBeInTheDocument();

    const expectedPaddingLeft = `(2px * 3) (4px * 3)`;
    expect(indentor).toHaveStyle(`padding-left: ${expectedPaddingLeft}`);
  });
});
