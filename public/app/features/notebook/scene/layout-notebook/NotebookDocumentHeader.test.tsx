import { render, screen } from 'test/test-utils';

import { useNotebookFieldFacetQuery } from '../../list/notebookSearchApi';

import { NotebookDocumentHeader } from './NotebookDocumentHeader';

jest.mock('../../list/notebookSearchApi', () => ({
  useNotebookFieldFacetQuery: jest.fn(),
}));

const mockUseSearchNotebooks = jest.mocked(useNotebookFieldFacetQuery);

/**
 * The tags the library carries, as the server's facet reports them — which is where the picker gets
 * its options, rather than from the notebooks themselves.
 */
function setLibraryTags(...tags: string[]) {
  mockUseSearchNotebooks.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the hook reads one facet
    {
      data: { items: [], facets: { tags: tags.map((value) => ({ value, count: 1 })) } },
    } as unknown as ReturnType<typeof useNotebookFieldFacetQuery>
  );
}

function setup(props: Partial<React.ComponentProps<typeof NotebookDocumentHeader>> = {}) {
  const onTagsChange = jest.fn();
  const rendered = render(
    <NotebookDocumentHeader
      title="Q2 latency regression"
      tags={['latency']}
      timeFrom="now-6h"
      timeTo="now"
      onTagsChange={onTagsChange}
      {...props}
    />
  );

  return { ...rendered, onTagsChange };
}

/**
 * MultiCombobox measures the field to decide how many chips fit before collapsing them into a `+N`,
 * and its option list is virtualized. jsdom reports zero for both, so without this the chips collapse
 * and the dropdown renders empty. grafana-ui's own Combobox tests do the same thing.
 */
function mockElementSize(width: number, height: number) {
  const rect = { width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0, toJSON: () => {} };
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', { value: () => rect, configurable: true });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get: () => width, configurable: true });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { get: () => height, configurable: true });
}

describe('NotebookDocumentHeader', () => {
  beforeAll(() => {
    mockElementSize(600, 400);
  });

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

    expect(screen.getByRole('combobox', { name: 'Tags' })).toBeInTheDocument();
  });

  // One tag rather than several on purpose. How many chips are shown is decided from a measured width,
  // and the ResizeObserver stand-in reports the same 500 for every element it is asked about - including
  // the overflow counter and the suffix, which are subtracted from it. The budget therefore comes out
  // negative here and everything past the first chip collapses into `+N`, whatever the real width is.
  // Asserting past that point would be asserting the stand-in, so this covers the chip itself and the
  // removal test below covers what a chip is for.
  it('shows a current tag as a removable chip', () => {
    setup({ isEditing: true, tags: ['latency'] });

    expect(screen.getByRole('button', { name: 'Remove latency' })).toBeInTheDocument();
  });

  it("offers every tag in the library, with the notebook's own already ticked", async () => {
    const { user } = setup({ isEditing: true, tags: ['latency'] });

    await user.click(screen.getByRole('combobox', { name: 'Tags' }));

    expect(await screen.findByRole('option', { name: 'checkout' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'errors' })).toBeInTheDocument();
    expect(screen.getByTestId('combobox-option-latency-checkbox')).toBeChecked();
    expect(screen.getByTestId('combobox-option-checkout-checkbox')).not.toBeChecked();
  });

  // A tag typed a moment ago is on no saved notebook, so nothing in the library listing would offer it.
  it('offers a tag the notebook already carries even when no other notebook has it', async () => {
    setLibraryTags('checkout');
    const { user } = setup({ isEditing: true, tags: ['bespoke'] });

    await user.click(screen.getByRole('combobox', { name: 'Tags' }));

    expect(await screen.findByRole('option', { name: 'bespoke' })).toBeInTheDocument();
    expect(screen.getByTestId('combobox-option-bespoke-checkbox')).toBeChecked();
  });

  it('adds a tag picked from the list', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency'] });

    await user.click(screen.getByRole('combobox', { name: 'Tags' }));
    await user.click(await screen.findByRole('option', { name: 'checkout' }));

    expect(onTagsChange).toHaveBeenCalledWith(['latency', 'checkout']);
  });

  it('adds a tag that exists nowhere yet', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency'] });

    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'incident');
    await user.keyboard('{arrowdown}{enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['latency', 'incident']);
  });

  it('removes a tag when its chip is dismissed', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency', 'slo'] });

    await user.click(screen.getByRole('button', { name: 'Remove latency' }));

    expect(onTagsChange).toHaveBeenCalledWith(['slo']);
  });

  // A custom value is the raw string typed, so this is the only thing standing between the user and a
  // tag with trailing whitespace that renders identically to an existing one.
  it('trims a tag typed by hand', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: [] });

    await user.type(screen.getByRole('combobox', { name: 'Tags' }), '  incident  ');
    await user.keyboard('{arrowdown}{enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['incident']);
  });

  // Lowercasing would rewrite tags the notebook already carried, not just the one being typed.
  it('leaves the case of a typed tag alone', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: [] });

    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'Production');
    await user.keyboard('{arrowdown}{enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['Production']);
  });

  // Pinning a known rough edge rather than endorsing it: MultiCombobox keeps the text that produced
  // the tag, and keeps the list filtered by it, so a second tag needs the field cleared by hand
  // first. It is internal state cleared only on blur, so the picker cannot help it. Flip this test
  // when MultiCombobox grows a way to opt out.
  it('leaves the typed text in the field once the tag is added', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: [] });

    const input = screen.getByRole('combobox', { name: 'Tags' });
    await user.type(input, 'incident');
    await user.keyboard('{arrowdown}{enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['incident']);
    expect(input).toHaveValue('incident');
  });

  // The picker is styled by reaching into grafana-ui's DOM, which no type or snapshot protects. These
  // two assert only that the selectors still match something: an earlier version of the first one used
  // a direct-child combinator and matched nothing at all, silently leaving the chrome in place.
  describe('the selectors the inline styling depends on', () => {
    it('still finds the element carrying the chrome', () => {
      setup({ isEditing: true, tags: ['latency'] });
      const input = screen.getByRole('combobox', { name: 'Tags' });

      // jsdom cannot evaluate :has, so assert the shape the selector turns on instead. The chrome is
      // on an ancestor div and the input's own parent is a span, which is why the selector has to be a
      // descendant match — an earlier attempt used `div:has(> input)` and matched nothing at all.
      expect(input.parentElement?.tagName).toBe('SPAN');
      expect(input.closest('div')).not.toBeNull();
    });

    it("still finds the dropdown toggle, without matching a chip's remove button", () => {
      setup({ isEditing: true, tags: ['latency'] });

      expect(document.querySelectorAll('svg[role="button"]')).toHaveLength(1);
    });
  });

  // Nothing to show and nothing to do with it, so the row would just be an empty label.
  it('hides the tags row entirely on an untagged notebook being read', () => {
    setup({ isEditing: false, tags: [] });

    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  // The opposite while editing: without the row there is no way to add the first tag.
  it('keeps the tags row on an untagged notebook being edited', () => {
    setup({ isEditing: true, tags: [] });

    expect(screen.getByRole('combobox', { name: 'Tags' })).toBeInTheDocument();
  });
});
