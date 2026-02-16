import { screen } from '@testing-library/react';

import { DataQuery } from '@grafana/schema';

import { renderWithQueryEditorProvider } from '../testUtils';
import { Transformation } from '../types';

import { SidebarFooter } from './SidebarFooter';

describe('SidebarFooter', () => {
  it('should show correct counts when all items are visible', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
    ];

    const transformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
    ];

    renderWithQueryEditorProvider(<SidebarFooter />, { queries, transformations });

    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // visible
    expect(screen.getByText('0')).toBeInTheDocument(); // hidden
  });

  it('should count hidden queries and disabled transformations', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
      { refId: 'C', datasource: { type: 'test', uid: 'test' }, hide: true },
    ];

    const transformations: Transformation[] = [
      { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
      {
        transformId: 'reduce',
        registryItem: undefined,
        transformConfig: { id: 'reduce', options: {}, disabled: true },
      },
    ];

    renderWithQueryEditorProvider(<SidebarFooter />, { queries, transformations });

    expect(screen.getByText('5 items')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // visible
    expect(screen.getByText('2')).toBeInTheDocument(); // hidden
  });

  it('should show zero counts when there are no items', () => {
    renderWithQueryEditorProvider(<SidebarFooter />);

    expect(screen.getByText('0 items')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2); // both visible and hidden are 0
  });
});
