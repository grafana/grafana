import { screen } from '@testing-library/react';

import { type DataTransformerInfo, type TransformerRegistryItem } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { type QueryEditorUIState } from '../QueryEditorContext';
import { makeStackedMode, renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { StackedEditorRenderer } from './StackedEditorRenderer';

// Stub StackedSection so the renderer test doesn't pull in datasource resolution or full editor
// chrome — the renderer's responsibility is composition (items in order, isCurrent, headingId),
// not the section's internals (those have their own tests).
jest.mock('./StackedSection', () => ({
  StackedSection: ({
    item,
    isCurrent,
    headingId,
  }: {
    item: { id: string; type: string };
    isCurrent: boolean;
    headingId: string;
  }) => (
    // Mirror headingId on a data-* attribute (not aria-labelledby) so the test can inspect the value
    // without claiming a11y semantics the mock doesn't actually fulfill.
    <section
      data-testid={`stacked-section-${item.type}-${item.id}`}
      data-stacked-editor-item-id={item.id}
      data-stacked-editor-item-type={item.type}
      data-heading-id={headingId}
      aria-current={isCurrent ? 'true' : undefined}
    />
  ),
}));

const queries: DataQuery[] = [
  { refId: 'A', datasource: { type: 'test', uid: 'test' } },
  { refId: 'B', datasource: { type: 'test', uid: 'test' } },
];

const transformerInfo: DataTransformerInfo = {
  id: 'organize',
  name: 'Organize fields',
  operator: jest.fn(),
};

const registryItem: TransformerRegistryItem = {
  id: 'organize',
  name: 'Organize fields',
  transformation: () => Promise.resolve(transformerInfo),
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

const transformations: Transformation[] = [
  { transformId: 'organize-0', transformConfig: { id: 'organize', options: {} }, registryItem },
];

function renderStackedEditor(uiStateOverrides: Partial<QueryEditorUIState> = {}) {
  return renderWithQueryEditorProvider(<StackedEditorRenderer />, {
    queries,
    transformations,
    selectedQuery: queries[0],
    uiStateOverrides: { stackedMode: makeStackedMode({ enabled: true }), ...uiStateOverrides },
  });
}

describe('StackedEditorRenderer', () => {
  it('renders one section per query and transformation in source order', () => {
    renderStackedEditor();

    const renderedItems = screen.getAllByTestId(/^stacked-section-/).map((section) => ({
      id: section.getAttribute('data-stacked-editor-item-id'),
      type: section.getAttribute('data-stacked-editor-item-type'),
    }));

    expect(renderedItems).toEqual([
      { id: 'A', type: QueryEditorType.Query },
      { id: 'B', type: QueryEditorType.Query },
      { id: 'organize-0', type: QueryEditorType.Transformation },
    ]);
  });

  it('shows the total item count in the header', () => {
    renderStackedEditor();

    expect(screen.getByText('Showing 3 items')).toBeInTheDocument();
  });

  it('marks the selected query as the current section', () => {
    renderStackedEditor({ selectedQuery: queries[1] });

    expect(screen.getByTestId(`stacked-section-${QueryEditorType.Query}-B`)).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId(`stacked-section-${QueryEditorType.Query}-A`)).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId(`stacked-section-${QueryEditorType.Transformation}-organize-0`)).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('marks the selected transformation as the current section', () => {
    renderStackedEditor({ selectedQuery: null, selectedTransformation: transformations[0] });

    expect(screen.getByTestId(`stacked-section-${QueryEditorType.Transformation}-organize-0`)).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByTestId(`stacked-section-${QueryEditorType.Query}-A`)).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId(`stacked-section-${QueryEditorType.Query}-B`)).not.toHaveAttribute('aria-current');
  });

  it('assigns a unique heading id to each section so screen readers can announce them', () => {
    renderStackedEditor();

    const headingIds = screen
      .getAllByTestId(/^stacked-section-/)
      .map((section) => section.getAttribute('data-heading-id'));

    expect(headingIds).toHaveLength(3);
    expect(new Set(headingIds).size).toBe(headingIds.length);
    expect(headingIds.every((id) => id && id.length > 0)).toBe(true);
  });

  it('clicking the exit button exits stacked mode', async () => {
    const exit = jest.fn();
    const { user } = renderStackedEditor({ stackedMode: makeStackedMode({ enabled: true, exit }) });

    await user.click(screen.getByRole('button', { name: /exit stacked view/i }));

    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('opens positioned on the selected card, not the first card', () => {
    // jsdom doesn't implement scrollIntoView, so it can't be spied — stub it and restore after.
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      // B is selected, not the first card — the renderer must derive B as the jump target.
      renderStackedEditor({ selectedQuery: queries[1] });

      // The renderer's contract is *which* section we land on. The scroll options ('auto' / 'start')
      // are the hook's contract and are covered in useStackedItemScroll.test.tsx.
      expect(scrollIntoView.mock.instances[0]).toBe(screen.getByTestId(`stacked-section-${QueryEditorType.Query}-B`));
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
