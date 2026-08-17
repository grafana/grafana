import { render, screen } from 'test/test-utils';

import { NotebookDocumentHeader } from './NotebookDocumentHeader';

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

describe('NotebookDocumentHeader', () => {
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

  it('offers the tag input once the notebook is being edited', () => {
    setup({ isEditing: true });

    expect(screen.getByRole('textbox', { name: 'Tags' })).toBeInTheDocument();
  });

  it('shows the current tags as removable chips', () => {
    setup({ isEditing: true, tags: ['latency', 'slo'] });

    expect(screen.getByRole('button', { name: 'Remove tag: latency' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove tag: slo' })).toBeInTheDocument();
  });

  it('adds a tag on Enter', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency'] });

    await user.type(screen.getByRole('textbox', { name: 'Tags' }), 'incident{Enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['latency', 'incident']);
  });

  it('removes a tag when its chip is dismissed', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: ['latency', 'slo'] });

    await user.click(screen.getByRole('button', { name: 'Remove tag: latency' }));

    expect(onTagsChange).toHaveBeenCalledWith(['slo']);
  });

  // TagsInput concatenates the raw field value, so this is the only thing standing between the user
  // and a tag with trailing whitespace that renders identically to an existing one.
  it('trims a tag typed by hand', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: [] });

    await user.type(screen.getByRole('textbox', { name: 'Tags' }), '  incident  {Enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['incident']);
  });

  // Lowercasing would rewrite tags the notebook already carried, not just the one being typed.
  it('leaves the case of a typed tag alone', async () => {
    const { user, onTagsChange } = setup({ isEditing: true, tags: [] });

    await user.type(screen.getByRole('textbox', { name: 'Tags' }), 'Production{Enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['Production']);
  });

  // The field is cleared by TagsInput itself once the tag is added, which is why it is used here
  // rather than a combobox that leaves the text behind.
  it('clears the field once the tag is added', async () => {
    const { user } = setup({ isEditing: true, tags: [] });

    const input = screen.getByRole('textbox', { name: 'Tags' });
    await user.type(input, 'incident{Enter}');

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

    expect(screen.getByRole('textbox', { name: 'Tags' })).toBeInTheDocument();
  });
});
