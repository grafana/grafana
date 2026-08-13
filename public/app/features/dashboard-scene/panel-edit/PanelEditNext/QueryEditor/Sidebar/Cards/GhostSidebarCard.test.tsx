import { screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';

import { QueryEditorType } from '../../../constants';
import { renderWithQueryEditorProvider } from '../../testUtils';

import { GhostSidebarCard } from './GhostSidebarCard';

describe('GhostSidebarCard', () => {
  it('uses the proportional font while retaining the pending-state treatment', () => {
    renderWithQueryEditorProvider(<GhostSidebarCard id="pending-query" type={QueryEditorType.Query} />);

    const label = screen.getByText('New Query');
    expect(getComputedStyle(label).fontFamily.replaceAll(' ', '')).toBe(
      createTheme().typography.fontFamily.replaceAll(' ', '')
    );
    expect(label).toHaveStyle({ fontStyle: 'italic' });
  });
});
