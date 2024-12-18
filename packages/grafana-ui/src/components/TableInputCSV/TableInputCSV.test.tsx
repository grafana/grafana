import { render, screen } from '@testing-library/react';

import { DataFrame } from '@grafana/data';

import { TableInputCSV } from './TableInputCSV';

describe('TableInputCSV', () => {
  it('renders correctly', () => {
    render(
      <TableInputCSV
        width={'100%'}
        height={200}
        text={'a,b,c\n1,2,3'}
        onSeriesParsed={(data: DataFrame[], text: string) => {}}
      />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Rows:1, Columns:3')).toBeInTheDocument();
  });
});
