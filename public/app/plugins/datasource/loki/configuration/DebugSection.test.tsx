import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DebugSection } from './DebugSection';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

describe('DebugSection', () => {
  it('does not render any table rows if no debug text', () => {
    render(<DebugSection derivedFields={[]} />);
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });

  it('renders derived fields as table rows', async () => {
    const derivedFields = [
      {
        matcherRegex: 'traceId=(\\w+)',
        name: 'traceIdLink',
        url: 'http://localhost/trace/${__value.raw}',
      },
      {
        matcherRegex: 'traceId=(\\w+)',
        name: 'traceId',
      },
      {
        matcherRegex: 'traceId=(',
        name: 'error',
      },
    ];

    render(<DebugSection derivedFields={derivedFields} />);
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'traceId=1234');

    expect(screen.getByRole('table')).toBeInTheDocument();
    // 3 rows + one header
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(4);
    expect(rows[1]).toHaveTextContent('http://localhost/trace/${__value.raw}');
  });
});
