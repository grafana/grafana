import { renderHook } from 'test/test-utils';

import { useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';

import { useNotebookTagOptions } from './useNotebookTagOptions';

jest.mock('app/api/clients/dashboard/v2beta1', () => ({
  useListNotebookQuery: jest.fn(),
}));

const mockUseListNotebookQuery = jest.mocked(useListNotebookQuery);

function setLibrary(...tagSets: Array<string[] | undefined>) {
  mockUseListNotebookQuery.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the hook only reads items
    {
      data: { items: tagSets.map((tags) => ({ spec: { tags } })) },
    } as unknown as ReturnType<typeof useListNotebookQuery>
  );
}

function values(currentTags?: string[]) {
  return renderHook(() => useNotebookTagOptions(currentTags)).result.current.map((option) => option.value);
}

describe('useNotebookTagOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('collects the tags of every notebook in the library', () => {
    setLibrary(['checkout'], ['errors', 'slo']);

    expect(values()).toEqual(['checkout', 'errors', 'slo']);
  });

  it('offers each tag once, however many notebooks carry it', () => {
    setLibrary(['latency'], ['latency', 'slo'], ['latency']);

    expect(values()).toEqual(['latency', 'slo']);
  });

  // Otherwise the dropdown would list the notebook's own tag as unticked while its pill sat in the field.
  it('includes the tags of the notebook being edited, even when nothing else carries them', () => {
    setLibrary(['checkout']);

    expect(values(['bespoke'])).toEqual(['bespoke', 'checkout']);
  });

  it('does not repeat a current tag the library already has', () => {
    setLibrary(['latency', 'checkout']);

    expect(values(['latency'])).toEqual(['checkout', 'latency']);
  });

  // Case-insensitively, so `Prod` does not sort away from `production`.
  it('sorts the options for a reader rather than by code point', () => {
    setLibrary(['slo', 'Checkout', 'errors']);

    expect(values()).toEqual(['Checkout', 'errors', 'slo']);
  });

  it('copes with a notebook that has no tags at all', () => {
    setLibrary(undefined, ['slo']);

    expect(values()).toEqual(['slo']);
  });

  it('labels each option with the tag itself', () => {
    setLibrary(['slo']);

    expect(renderHook(() => useNotebookTagOptions()).result.current).toEqual([{ label: 'slo', value: 'slo' }]);
  });
});
