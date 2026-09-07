import { renderHook } from 'test/test-utils';

import { useNotebookFieldFacetQuery } from '../../list/notebookSearchApi';

import { useNotebookTagOptions } from './useNotebookTagOptions';

jest.mock('../../list/notebookSearchApi', () => ({
  useNotebookFieldFacetQuery: jest.fn(),
}));

const mockUseSearchNotebooks = jest.mocked(useNotebookFieldFacetQuery);

/** The tag terms the server aggregated, as the facet returns them. */
function setFacet(...tags: string[]) {
  mockUseSearchNotebooks.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the hook reads one facet
    {
      data: { items: [], facets: { tags: tags.map((value) => ({ value, count: 1 })) } },
    } as unknown as ReturnType<typeof useNotebookFieldFacetQuery>
  );
}

/** No answer at all: the route is not served, or the request failed. */
function setNoAnswer() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- absence is all this needs
  mockUseSearchNotebooks.mockReturnValue({ data: undefined } as unknown as ReturnType<
    typeof useNotebookFieldFacetQuery
  >);
}

function values(currentTags?: string[]) {
  return renderHook(() => useNotebookTagOptions(currentTags)).result.current.map((option) => option.value);
}

describe('useNotebookTagOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setFacet();
  });

  it('offers the tags the server aggregated', () => {
    setFacet('checkout', 'errors', 'slo');

    expect(values()).toEqual(['checkout', 'errors', 'slo']);
  });

  /**
   * The whole point of the facet: the server counts the distinct values, so the tags arrive without a
   * single notebook being fetched. The list endpoint returns full specs - every cell, panel and query -
   * which is a lot of payload to read a handful of strings off.
   */
  it('asks for the tags facet rather than for notebooks', () => {
    renderHook(() => useNotebookTagOptions());

    expect(mockUseSearchNotebooks).toHaveBeenCalledTimes(1);
    expect(mockUseSearchNotebooks).toHaveBeenLastCalledWith({ field: 'tags', limit: 100 });
  });

  // Otherwise the dropdown would list the notebook's own tag as unticked while its pill sat in the field.
  it('includes the tags of the notebook being edited, even when nothing else carries them', () => {
    setFacet('checkout');

    expect(values(['bespoke'])).toEqual(['bespoke', 'checkout']);
  });

  it('does not repeat a current tag the facet already offers', () => {
    setFacet('latency', 'checkout');

    expect(values(['latency'])).toEqual(['checkout', 'latency']);
  });

  // Case-insensitively, so `Prod` does not sort away from `production`.
  it('sorts the options for a reader rather than by code point', () => {
    setFacet('slo', 'Checkout', 'errors');

    expect(values()).toEqual(['Checkout', 'errors', 'slo']);
  });

  /**
   * The search route is not served everywhere and this asks for no fallback, so the dropdown is left
   * offering what the notebook already has. The picker takes custom values, so nothing is unreachable -
   * the suggestions are just gone.
   */
  it('falls back to the notebook own tags when there is no facet to read', () => {
    setNoAnswer();

    expect(values(['latency'])).toEqual(['latency']);
  });

  it('copes with no answer and no tags of its own', () => {
    setNoAnswer();

    expect(values()).toEqual([]);
  });

  it('labels each option with the tag itself', () => {
    setFacet('slo');

    expect(renderHook(() => useNotebookTagOptions()).result.current).toEqual([{ label: 'slo', value: 'slo' }]);
  });
});
