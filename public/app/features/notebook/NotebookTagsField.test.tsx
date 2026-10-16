import { type UserEvent } from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen, within } from 'test/test-utils';

import { NotebookTagsField } from './NotebookTagsField';
import { useLazyNotebookFieldFacetQuery } from './list/notebookSearchApi';

// The real endpoint calls injectEndpoints on the client as it loads, which nothing here provides.
jest.mock('./list/notebookSearchApi', () => ({
  useLazyNotebookFieldFacetQuery: jest.fn(),
}));

const mockUseLazyNotebookFieldFacetQuery = jest.mocked(useLazyNotebookFieldFacetQuery);

/** TagFilter's own aria-label. It takes no override, and dashboards' filter is named the same. */
const TAG_FILTER = 'Tag filter';

/**
 * The facet the picker loads when it is focused. `undefined` stands for the answer where the search
 * route is not served: a 404, with nothing to read.
 */
function setFacet(terms: Array<{ value: string; count: number }> | undefined) {
  const trigger = jest.fn().mockResolvedValue({
    data: terms
      ? { items: [], metadata: { totalHits: 0, totalHitsRelation: 'eq' }, facets: { tags: terms } }
      : undefined,
  });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the component reads only the trigger
  mockUseLazyNotebookFieldFacetQuery.mockReturnValue([trigger] as unknown as ReturnType<
    typeof useLazyNotebookFieldFacetQuery
  >);
  return trigger;
}

/**
 * Opens the picker and chooses a tag.
 *
 * The options are fetched when the control is focused, so they are awaited before
 * `selectOptionInTest` runs: that helper wraps its own `waitFor`, which nests badly with the load
 * still in flight and times out instead of retrying into it. Matching is by prefix because an
 * option's text carries the count — "latency (3)".
 */
async function pickTag(user: UserEvent, tag: string) {
  await user.click(screen.getByLabelText(TAG_FILTER));
  // Scoped to the menu: a tag already selected renders a badge with the same text. The label is the
  // option's only direct text, so this matches it and not the count beside it.
  await within(await screen.findByRole('listbox')).findByText(tag);
  await selectOptionInTest(screen.getByLabelText(TAG_FILTER), new RegExp(`^${tag}`));
}

describe('NotebookTagsField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the chosen tag to the caller rather than filtering anything itself', async () => {
    setFacet([{ value: 'latency', count: 3 }]);
    const onChange = jest.fn();
    const { user } = render(<NotebookTagsField value={[]} onChange={onChange} placeholder="Filter by tag" />);

    await pickTag(user, 'latency');

    expect(onChange).toHaveBeenCalledWith(['latency']);
  });

  // Selecting a second tag narrows the list, so it has to arrive alongside the first rather than
  // replacing it.
  it('adds to the selection rather than replacing it', async () => {
    setFacet([
      { value: 'latency', count: 3 },
      { value: 'slo', count: 1 },
    ]);
    const onChange = jest.fn();
    const { user } = render(<NotebookTagsField value={['slo']} onChange={onChange} placeholder="Filter by tag" />);

    await pickTag(user, 'latency');

    expect(onChange).toHaveBeenCalledWith(['slo', 'latency']);
  });

  it('asks for the tags facet only once the picker is opened', async () => {
    const trigger = setFacet([{ value: 'latency', count: 3 }]);
    const { user } = render(<NotebookTagsField value={[]} onChange={jest.fn()} placeholder="Filter by tag" />);

    // A filter row nobody touches costs no request at all.
    expect(trigger).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(TAG_FILTER));

    // `true` is preferCacheValue: the facet is asked once per mount rather than on every focus.
    expect(trigger).toHaveBeenCalledWith({ field: 'tags', limit: 1000 }, true);
  });

  // The count is what makes one tag worth reaching for over another, and the facet already carries
  // it.
  it('offers each tag with the number of notebooks carrying it', async () => {
    setFacet([{ value: 'cost', count: 11 }]);
    const { user } = render(<NotebookTagsField value={[]} onChange={jest.fn()} placeholder="Filter by tag" />);

    await user.click(screen.getByLabelText(TAG_FILTER));

    expect(await screen.findByRole('option')).toHaveTextContent('cost (11)');
  });

  // A tag can still be filtered on after it stops appearing in the facet — the last notebook
  // carrying it was retagged, or it fell outside the facet's limit. Dropping the badge would leave
  // the list filtered by something invisible.
  it('keeps a selected tag visible when the facet no longer offers it', async () => {
    setFacet([{ value: 'slo', count: 1 }]);
    render(<NotebookTagsField value={['retired-tag']} onChange={jest.fn()} placeholder="Filter by tag" />);

    expect(await screen.findByText('retired-tag')).toBeInTheDocument();
  });

  // Only the callers that set a notebook's tags opt into this — a tag has to be invented somewhere.
  // The ones that filter leave it off, so their dropdown is the only route in.
  it('reports a typed tag when the caller allows creating one', async () => {
    setFacet([{ value: 'cost', count: 11 }]);
    const onChange = jest.fn();
    const { user } = render(
      <NotebookTagsField value={[]} onChange={onChange} placeholder="Filter by tag" allowCustomValue />
    );

    await user.type(screen.getByLabelText(TAG_FILTER), 'rarely-used');
    await user.keyboard('{enter}');

    expect(onChange).toHaveBeenCalledWith(['rarely-used']);
  });

  describe('when the facet cannot answer', () => {
    // The tags a caller already holds are the only ones there are to offer where the search route is
    // not served — which is the default, so this is the ordinary case rather than the exotic one.
    it("offers the caller's fallback tags", async () => {
      setFacet(undefined);
      const { user } = render(
        <NotebookTagsField
          value={[]}
          onChange={jest.fn()}
          placeholder="Filter by tag"
          fallbackTags={['errors', 'latency']}
        />
      );

      await user.click(screen.getByLabelText(TAG_FILTER));
      const listbox = await screen.findByRole('listbox');

      expect(await within(listbox).findByText('errors')).toBeInTheDocument();
      expect(within(listbox).getByText('latency')).toBeInTheDocument();
    });

    // A count over whatever one caller loaded is not the library's, so none is shown.
    it('shows no counts beside them', async () => {
      setFacet(undefined);
      const { user } = render(
        <NotebookTagsField value={[]} onChange={jest.fn()} placeholder="Filter by tag" fallbackTags={['errors']} />
      );

      await user.click(screen.getByLabelText(TAG_FILTER));

      expect(await screen.findByRole('option')).toHaveTextContent('errors');
      expect(screen.getByRole('option')).not.toHaveTextContent('(');
    });

    it('picks one the same way, so it reaches the caller', async () => {
      setFacet(undefined);
      const onChange = jest.fn();
      const { user } = render(
        <NotebookTagsField value={[]} onChange={onChange} placeholder="Filter by tag" fallbackTags={['latency']} />
      );

      await pickTag(user, 'latency');

      expect(onChange).toHaveBeenCalledWith(['latency']);
    });
  });

  // The facet knows the whole library and the counts; a caller's own rows are a lesser source, so
  // they are only reached for when there is nothing else.
  it('prefers the facet over the fallback when it answers', async () => {
    setFacet([{ value: 'cost', count: 11 }]);
    const { user } = render(
      <NotebookTagsField value={[]} onChange={jest.fn()} placeholder="Filter by tag" fallbackTags={['errors']} />
    );

    await user.click(screen.getByLabelText(TAG_FILTER));
    const listbox = await screen.findByRole('listbox');

    expect(await within(listbox).findByText('cost')).toBeInTheDocument();
    expect(within(listbox).queryByText('errors')).not.toBeInTheDocument();
  });

  // Where the search route is not served the facet cannot answer. The picker is still offered, and
  // comes up empty rather than throwing out of the focus handler that loaded it.
  it('comes up empty when there is no facet to read', async () => {
    setFacet(undefined);
    const { user } = render(<NotebookTagsField value={[]} onChange={jest.fn()} placeholder="Filter by tag" />);

    await user.click(screen.getByLabelText(TAG_FILTER));

    expect(await screen.findByText('No tags found')).toBeInTheDocument();
  });
});
