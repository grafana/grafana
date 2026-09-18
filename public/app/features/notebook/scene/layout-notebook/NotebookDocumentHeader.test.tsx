import { render, screen, within } from 'test/test-utils';

import { useLazyNotebookFieldFacetQuery } from '../../list/notebookSearchApi';

import { NotebookDocumentHeader } from './NotebookDocumentHeader';

jest.mock('../../list/notebookSearchApi', () => ({
  useLazyNotebookFieldFacetQuery: jest.fn(),
}));

const mockUseLazyFacet = jest.mocked(useLazyNotebookFieldFacetQuery);

/**
 * The tags the library carries, as the server's facet reports them — which is where the picker gets
 * its options, rather than from the notebooks themselves.
 */
function setLibraryTags(...tags: string[]) {
  const trigger = jest.fn().mockResolvedValue({
    data: { items: [], facets: { tags: tags.map((value) => ({ value, count: 1 })) } },
  });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the field reads only the trigger
  mockUseLazyFacet.mockReturnValue([trigger] as unknown as ReturnType<typeof useLazyNotebookFieldFacetQuery>);
}

/** The field, by the label the reader sees beside it. */
function tagInput() {
  return screen.getByLabelText('Tags');
}

/**
 * Opens the picker and chooses an existing tag. The options are fetched when the field is focused, so
 * they are awaited first; they are matched by text because every option carries the same
 * "Tag option" aria-label.
 */
async function pickTag(user: ReturnType<typeof setup>['user'], tag: string) {
  await user.click(tagInput());
  const listbox = await screen.findByRole('listbox');
  await user.click(await within(listbox).findByText(tag));
}

function setup(props: Partial<React.ComponentProps<typeof NotebookDocumentHeader>> = {}) {
  const onTagsChange = jest.fn();
  const onTitleChange = jest.fn();
  const rendered = render(
    <NotebookDocumentHeader
      title="Q2 latency regression"
      tags={['latency']}
      timeFrom="now-6h"
      timeTo="now"
      onTagsChange={onTagsChange}
      onTitleChange={onTitleChange}
      {...props}
    />
  );

  return { ...rendered, onTagsChange, onTitleChange };
}

describe('NotebookDocumentHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLibraryTags('checkout', 'errors', 'latency', 'slo');
  });

  it('shows the tags under a Tags label, without a picker, while the notebook is being read', () => {
    setup({ isEditing: false });

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('latency')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('labels the time range too, so the two rows read as a pair', () => {
    setup({ isEditing: false });

    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('now-6h → now')).toBeInTheDocument();
  });

  it('offers the tag picker once the notebook is being edited', () => {
    setup({ isEditing: true });

    // Associated with the row's own "Tags" label. TagFilter also carries a hardcoded
    // aria-label of its own, which is what a screen reader announces.
    expect(tagInput()).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tag filter' })).toBeInTheDocument();
  });

  // Every tag stays visible as its own chip, rather than collapsing into a counter once they no
  // longer fit — which is why both are asserted here.
  it('shows each current tag as a removable chip', () => {
    setup({ isEditing: true, tags: ['latency', 'slo'] });

    expect(screen.getByRole('button', { name: 'Remove latency' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove slo' })).toBeInTheDocument();
  });

  it("offers every tag in the library, alongside the notebook's own", async () => {
    const { user } = setup({ isEditing: true, tags: ['latency'] });

    await user.click(tagInput());
    const listbox = await screen.findByRole('listbox');

    expect(await within(listbox).findByText('checkout')).toBeInTheDocument();
    expect(within(listbox).getByText('errors')).toBeInTheDocument();
    // Its own tag is in the field as a chip, whether or not the library still offers it.
    expect(screen.getByRole('button', { name: 'Remove latency' })).toBeInTheDocument();
  });

  // A tag typed a moment ago is on no saved notebook, so nothing in the library listing would offer
  // it — but it is on this one, so it has to stay visible.
  it('keeps a tag the notebook carries even when no other notebook has it', async () => {
    setLibraryTags('checkout');
    setup({ isEditing: true, tags: ['bespoke'] });

    expect(await screen.findByRole('button', { name: 'Remove bespoke' })).toBeInTheDocument();
  });

  it('adds a tag picked from the list', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency'] });

    await pickTag(user, 'checkout');

    expect(onTagsChange).toHaveBeenCalledWith(['latency', 'checkout']);
  });

  it('adds a tag that exists nowhere yet', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency'] });

    await user.type(tagInput(), 'incident');
    await user.keyboard('{enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['latency', 'incident']);
  });

  it('removes a tag when its chip is dismissed', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency', 'slo'] });

    await user.click(screen.getByRole('button', { name: 'Remove latency' }));

    expect(onTagsChange).toHaveBeenCalledWith(['slo']);
  });

  // Left exactly as typed, as TagsInput leaves a dashboard's tags: no trim, no case folding. A tag is
  // the string the user chose, and rewriting it here would also rewrite the ones already on the
  // notebook, which arrive through this same callback.
  it('leaves a typed tag exactly as it was entered', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: [] });

    await user.type(tagInput(), 'Production');
    await user.keyboard('{enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['Production']);
  });

  // Adding two tags in a row used to mean clearing the field by hand in between, which is most of
  // why this field was moved off MultiCombobox.
  it('clears the typed text once the tag is added', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: [] });

    const input = tagInput();
    await user.type(input, 'incident');
    await user.keyboard('{enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['incident']);
    expect(input).toHaveValue('');
  });

  // Nothing to show and nothing to do with it, so the row would just be an empty label.
  it('hides the tags row entirely on an untagged notebook being read', () => {
    setup({ isEditing: false, tags: [] });

    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  // The opposite while editing: without the row there is no way to add the first tag.
  it('keeps the tags row on an untagged notebook being edited', () => {
    setup({ isEditing: true, tags: [] });

    expect(tagInput()).toBeInTheDocument();
  });

  describe('the title', () => {
    it('is a plain heading with no way in while the notebook is being read', () => {
      setup({ isEditing: false });

      expect(screen.getByRole('heading', { name: 'Q2 latency regression' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit title' })).not.toBeInTheDocument();
    });

    it('is the heading and the way into editing it once the notebook is being edited', () => {
      setup({ isEditing: true });

      expect(screen.getByRole('heading', { name: 'Q2 latency regression' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit title' })).toBeInTheDocument();
    });

    it('reports the new title as it is typed', async () => {
      const { user, onTitleChange } = setup({ isEditing: true });

      await user.click(screen.getByRole('button', { name: 'Edit title' }));
      const input = screen.getByRole('textbox', { name: 'Title' });
      await user.clear(input);
      await user.type(input, 'Q3');

      expect(onTitleChange).toHaveBeenLastCalledWith('Q3');
    });

    // The read-only branch renders nothing for an empty title; this one has to, or there is no way back.
    it('still offers a way in on a notebook whose title is empty', () => {
      setup({ isEditing: true, title: '' });

      expect(screen.getByRole('button', { name: 'Edit title' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Add a title' })).toBeInTheDocument();
    });

    // Edit mode can be left without the field ever blurring: the Back button dropping `?edit=true`.
    it('keeps a title typed but never blurred when the notebook leaves edit mode', async () => {
      const { user, rerender } = setup({ isEditing: true, title: 'Q2 latency regression' });

      await user.click(screen.getByRole('button', { name: 'Edit title' }));
      await user.clear(screen.getByRole('textbox', { name: 'Title' }));
      await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Q3 latency regression');

      rerender(
        <NotebookDocumentHeader
          title="Q3 latency regression"
          tags={['latency']}
          timeFrom="now-6h"
          timeTo="now"
          isEditing={false}
        />
      );

      expect(screen.getByRole('heading', { name: 'Q3 latency regression' })).toBeInTheDocument();
    });
  });
});
