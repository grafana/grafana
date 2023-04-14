import { render, screen } from '@testing-library/react';
import React from 'react';

import { PageInfoItem } from '../Page/types';

import { PageInfo } from './PageInfo';

describe('PageInfo', () => {
  it('renders the label and value for each info item', () => {
    const info: PageInfoItem[] = [
      {
        label: 'label1',
        value: 'value1',
      },
      {
        label: 'label2',
        value: 2,
      },
    ];
    render(<PageInfo info={info} />);

    // Check labels are visible
    expect(screen.getByText('label1')).toBeInTheDocument();
    expect(screen.getByText('label2')).toBeInTheDocument();

    // Check values are visible
    expect(screen.getByText('value1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('can render a custom element as a value', () => {
    const info: PageInfoItem[] = [
      {
        label: 'label1',
        value: <div data-testid="custom-value">value1</div>,
      },
    ];
    render(<PageInfo info={info} />);

    expect(screen.getByTestId('custom-value')).toBeInTheDocument();
  });

  it('renders separators between the info items', () => {
    const info: PageInfoItem[] = [
      {
        label: 'label1',
        value: 'value1',
      },
      {
        label: 'label2',
        value: 'value2',
      },
      {
        label: 'label3',
        value: 'value3',
      },
    ];
    render(<PageInfo info={info} />);

    expect(screen.getAllByTestId('page-info-separator')).toHaveLength(info.length - 1);
  });
});
