import { render, screen } from '@testing-library/react';
import React from 'react';

import { MetaInfoText, MetaItemProps } from './MetaInfoText';
describe('MetaInfoText', () => {
  it('should render component and items', () => {
    const items: MetaItemProps[] = [
      { label: 'label', value: 'value' },
      { label: 'label2', value: 'value2' },
    ];

    render(<MetaInfoText metaItems={items} />);
    expect(screen.getAllByTestId('meta-info-text')).toHaveLength(1);
    expect(screen.getAllByTestId('meta-info-text-item')).toHaveLength(2);
    expect(screen.getByText('label:')).toBeInTheDocument();
    expect(screen.getByText('label2:')).toBeInTheDocument();
    expect(screen.getByText(/^value$/)).toBeInTheDocument();
    expect(screen.getByText(/^value2$/)).toBeInTheDocument();
  });

  it('should render component with no items when the array is empty', () => {
    const items: MetaItemProps[] = [];
    render(<MetaInfoText metaItems={items} />);
    expect(screen.getAllByTestId('meta-info-text')).toHaveLength(1);
    expect(screen.queryByTestId('meta-info-text-item')).toBeNull();
  });
});
