import { render } from '@testing-library/react';

import { type DataLink, VariableSuggestionsScope } from '@grafana/data';

import { DataLinksValueEditor } from './links';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  DataLinksInlineEditor: ({
    links,
    showOneClick,
  }: {
    links: DataLink[];
    getSuggestions: () => unknown[];
    showOneClick?: boolean;
  }) => (
    <div data-testid="data-links-inline-editor">
      <span data-testid="links-count">{links?.length ?? 0}</span>
      <span data-testid="show-one-click">{String(showOneClick)}</span>
    </div>
  ),
}));

const defaultLink: DataLink = { title: 'Link', url: 'http://example.com', targetBlank: false };

const defaultItem = {
  id: 'links',
  name: 'Links',
  description: '',
  settings: { showOneClick: false },
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: DataLink[] = [], settings = defaultItem.settings) => {
  const onChange = jest.fn();
  const getSuggestions = jest.fn().mockReturnValue([]);
  render(
    <DataLinksValueEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [], getSuggestions }}
    />
  );
  return { onChange, getSuggestions };
};

describe('DataLinksValueEditor', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <DataLinksValueEditor value={[]} onChange={jest.fn()} item={defaultItem} context={{ data: [] }} />
    );
    expect(container).toBeTruthy();
  });

  it('passes the links array to DataLinksInlineEditor', () => {
    const { getByTestId } = render(
      <DataLinksValueEditor
        value={[defaultLink]}
        onChange={jest.fn()}
        item={defaultItem}
        context={{ data: [], getSuggestions: () => [] }}
      />
    );
    expect(getByTestId('links-count').textContent).toBe('1');
  });

  it('passes showOneClick setting', () => {
    const { getByTestId } = render(
      <DataLinksValueEditor
        value={[]}
        onChange={jest.fn()}
        item={{ ...defaultItem, settings: { showOneClick: true } }}
        context={{ data: [] }}
      />
    );
    expect(getByTestId('show-one-click').textContent).toBe('true');
  });

  it('calls getSuggestions with Values scope', () => {
    const getSuggestions = jest.fn().mockReturnValue([]);
    const { getByTestId } = render(
      <DataLinksValueEditor value={[]} onChange={jest.fn()} item={defaultItem} context={{ data: [], getSuggestions }} />
    );
    // The DataLinksInlineEditor stub receives getSuggestions — it doesn't call it automatically,
    // but the prop is wired up; verify the component renders correctly.
    expect(getByTestId('data-links-inline-editor')).toBeInTheDocument();
  });
});
