import { render, screen } from '@testing-library/react';
import React from 'react';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders correctly', () => {
    render(
      <Tooltip placement="auto" content="Tooltip text">
        <a className="test-class" href="http://www.grafana.com">
          Link with tooltip
        </a>
      </Tooltip>
    );
    expect(screen.getByText('Link with tooltip')).toBeInTheDocument();
  });
});
