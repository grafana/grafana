import { screen } from '@testing-library/react';

import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { SingleItemRenderer } from './SingleItemRenderer';

// The section's internals have their own tests; here we only care which card is rendered and how.
jest.mock('./StackedSection', () => ({
  StackedSection: ({ item, isCurrent }: { item: { id: string; type: string }; isCurrent: boolean }) => (
    <section data-testid="stacked-section" data-item-key={`${item.type}:${item.id}`} data-current={String(isCurrent)} />
  ),
}));

const query: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
const transformation: Transformation = {
  registryItem: undefined,
  transformId: 'transform-1',
  transformConfig: { id: 'reduce', options: {} },
};

describe('SingleItemRenderer', () => {
  it('renders the selected query as the current card', () => {
    renderWithQueryEditorProvider(<SingleItemRenderer />, { queries: [query], selectedQuery: query });

    const section = screen.getByTestId('stacked-section');
    expect(section).toHaveAttribute('data-item-key', 'query:A');
    expect(section).toHaveAttribute('data-current', 'true');
  });

  it('renders the selected transformation as the current card', () => {
    renderWithQueryEditorProvider(<SingleItemRenderer />, {
      queries: [query],
      transformations: [transformation],
      selectedTransformation: transformation,
    });

    expect(screen.getByTestId('stacked-section')).toHaveAttribute('data-item-key', 'transformation:transform-1');
  });

  it('shows the query when a query and a transformation are both selected', () => {
    renderWithQueryEditorProvider(<SingleItemRenderer />, {
      queries: [query],
      transformations: [transformation],
      selectedQuery: query,
      selectedTransformation: transformation,
      uiStateOverrides: { cardType: QueryEditorType.Query },
    });

    expect(screen.getAllByTestId('stacked-section')).toHaveLength(1);
    expect(screen.getByTestId('stacked-section')).toHaveAttribute('data-item-key', 'query:A');
  });

  it('renders no card when nothing is selected', () => {
    renderWithQueryEditorProvider(<SingleItemRenderer />, { queries: [query] });

    expect(screen.queryByTestId('stacked-section')).not.toBeInTheDocument();
  });

  it('shows the datasource error once, above the card', () => {
    renderWithQueryEditorProvider(<SingleItemRenderer />, {
      queries: [query],
      selectedQuery: query,
      dsState: { dsError: new Error('Datasource unavailable') },
    });

    const alert = screen.getByText('Datasource unavailable');
    expect(screen.getAllByText('Datasource unavailable')).toHaveLength(1);
    expect(alert.compareDocumentPosition(screen.getByTestId('stacked-section'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
