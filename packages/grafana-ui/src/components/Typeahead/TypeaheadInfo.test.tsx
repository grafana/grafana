import { render, screen } from '@testing-library/react';
import React from 'react';

import { CompletionItem } from '../../types';

import { TypeaheadInfo } from './TypeaheadInfo';

describe('TypeaheadInfo component', () => {
  it('should show documentation as rendered markdown if passed as markdown', () => {
    const item: CompletionItem = { label: 'markdown', documentation: '# My heading' };
    render(<TypeaheadInfo item={item} height={100} />);
    expect(screen.getByRole('heading', { name: 'My heading' })).toBeInTheDocument();
  });
});
