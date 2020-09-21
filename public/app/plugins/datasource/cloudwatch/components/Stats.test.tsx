import React from 'react';
import { render, screen } from '@testing-library/react';
import { Stats } from './Stats';

const toOption = (value: any) => ({ label: value, value });

describe('Stats', () => {
  it('should render component', () => {
    render(
      <Stats
        values={['Average', 'Minimum']}
        variableOptionGroup={{ label: 'templateVar', value: 'templateVar' }}
        onChange={() => {}}
        stats={['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'].map(toOption)}
      />
    );
    expect(screen.getByTestId('stats')).toBeInTheDocument();
  });
});
