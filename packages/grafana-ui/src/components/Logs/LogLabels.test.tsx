import { render, screen } from '@testing-library/react';
import React from 'react';

import { LogLabels } from './LogLabels';

describe('<LogLabels />', () => {
  it('renders notice when no labels are found', () => {
    render(<LogLabels labels={{}} />);
    expect(screen.queryByText('(no unique labels)')).toBeInTheDocument();
  });
  it('renders labels', () => {
    render(<LogLabels labels={{ foo: 'bar', baz: '42' }} />);
    expect(screen.queryByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('42')).toBeInTheDocument();
  });
  it('excludes labels with certain names or labels starting with underscore', () => {
    render(<LogLabels labels={{ foo: 'bar', level: '42', _private: '13' }} />);
    expect(screen.queryByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(screen.queryByText('13')).not.toBeInTheDocument();
  });
  it('excludes labels with empty string values', () => {
    render(<LogLabels labels={{ foo: 'bar', baz: '' }} />);
    expect(screen.queryByText('bar')).toBeInTheDocument();
    expect(screen.queryByText('baz')).not.toBeInTheDocument();
  });
});
