import React from 'react';
import { Messages } from 'app/percona/settings/Settings.messages';
import { Diagnostics } from './Diagnostics';
import { render, screen } from '@testing-library/react';

describe('Diagnostics::', () => {
  it('Renders diagnostics correctly', () => {
    const {
      diagnostics: { action, label },
    } = Messages;
    render(<Diagnostics />);

    expect(screen.getByTestId('diagnostics-label')).toHaveTextContent(label);
    expect(screen.getByTestId('diagnostics-button')).toHaveTextContent(action);
  });
});
