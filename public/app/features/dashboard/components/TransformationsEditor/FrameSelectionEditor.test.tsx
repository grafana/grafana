import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FrameMatcherID, type StandardEditorsRegistryItem, toDataFrame } from '@grafana/data';

import { FrameMultiSelectionEditor, FrameSelectionEditor } from './FrameSelectionEditor';

const context = {
  data: [toDataFrame({ refId: 'A', fields: [] }), toDataFrame({ refId: 'B', fields: [] })],
};

const item = {} as StandardEditorsRegistryItem;

describe('FrameSelectionEditor', () => {
  it('emits a byRefId matcher when a query is selected', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <FrameSelectionEditor value={{ id: FrameMatcherID.byRefId }} context={context} item={item} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Query: B'));

    expect(onChange).toHaveBeenCalledWith({ id: FrameMatcherID.byRefId, options: 'B' });
  });

  it('shows the selected refId', () => {
    render(
      <FrameSelectionEditor
        value={{ id: FrameMatcherID.byRefId, options: 'A' }}
        context={context}
        item={item}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText('Query: A')).toBeInTheDocument();
  });

  it('emits undefined when the selection is cleared', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <FrameSelectionEditor
        value={{ id: FrameMatcherID.byRefId, options: 'A' }}
        context={context}
        item={item}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear value' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe('FrameMultiSelectionEditor', () => {
  it('emits a byRefId matcher with a regexp of the selected refIds', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <FrameMultiSelectionEditor
        value={{ id: FrameMatcherID.byRefId, options: '/^(?:A)$/' }}
        context={context}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Query: B'));

    expect(onChange).toHaveBeenCalledWith({ id: FrameMatcherID.byRefId, options: '/^(?:A|B)$/' });
  });

  it('emits undefined when all selections are cleared', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <FrameMultiSelectionEditor
        value={{ id: FrameMatcherID.byRefId, options: '/^(?:A)$/' }}
        context={context}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear value' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
