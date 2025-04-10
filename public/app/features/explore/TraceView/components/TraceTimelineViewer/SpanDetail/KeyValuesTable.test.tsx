// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { SpanLinkDef } from '../../types';

import KeyValuesTable, { LinkValue, KeyValuesTableProps } from './KeyValuesTable';

const data = [
  { key: 'span.kind', value: 'client' },
  { key: 'omg', value: 'mos-def' },
  { key: 'numericString', value: '12345678901234567890' },
  { key: 'jsonkey', value: JSON.stringify({ hello: 'world' }) },
];

const setup = (propOverrides?: Partial<KeyValuesTableProps>) => {
  const props = {
    data: data,
    ...propOverrides,
  };
  return render(
    <MemoryRouter>
      <KeyValuesTable {...(props as KeyValuesTableProps)} />
    </MemoryRouter>
  );
};

describe('LinkValue', () => {
  it('renders as expected', () => {
    const title = 'titleValue';
    const href = 'hrefValue';
    const childrenText = 'childrenTextValue';
    render(
      <LinkValue href={href} title={title}>
        {childrenText}
      </LinkValue>
    );
    expect(screen.getByRole('link', { name: 'titleValue' })).toBeInTheDocument();
    expect(screen.getByText(/^childrenTextValue$/)).toBeInTheDocument();
  });
});

describe('KeyValuesTable tests', () => {
  it('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  it('renders a table', () => {
    setup();

    expect(screen.getByTestId('KeyValueTable')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
  it('renders a table row for each data element', () => {
    setup();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('cell')).toHaveLength(12);
    expect(screen.getAllByTestId('KeyValueTable--keyColumn')).toHaveLength(4);
    expect(screen.getByRole('row', { name: 'span.kind "client"' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'jsonkey { "hello": "world" }' })).toBeInTheDocument();
  });

  it('renders the most relevant link for the attribute', () => {
    setup({
      links: [
        { href: 'https://example.com/omg', resourceAttributes: ['span.kind', 'omg'] } as unknown as SpanLinkDef,
        { href: 'https://example.com/span-kind', resourceAttributes: ['span.kind'] } as unknown as SpanLinkDef,
      ],
    });

    const omgLink = screen.getByRole('link', { name: '"mos-def"' });
    expect(omgLink.tagName).toBe('A');
    expect(omgLink.attributes.getNamedItem('href')?.value).toBe('https://example.com/omg');

    const spanKindLink = screen.getByRole('link', { name: '"client"' });
    expect(spanKindLink.tagName).toBe('A');
    expect(spanKindLink.attributes.getNamedItem('href')?.value).toBe('https://example.com/span-kind');
  });

  it('renders a <CopyIcon /> for each data element', () => {
    setup();

    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('renders a link in json and properly escapes it', () => {
    setup({
      data: [
        { key: 'jsonkey', value: JSON.stringify({ hello: 'https://example.com"id=x tabindex=1 onfocus=alert(1)' }) },
      ],
    });
    const link = screen.getByText(/https:\/\/example.com/);
    expect(link.tagName).toBe('A');
    expect(link.attributes.getNamedItem('href')?.value).toBe(
      'https://example.com%22id=x%20tabindex=1%20onfocus=alert(1)'
    );
  });

  it('properly escapes json values', () => {
    setup({
      data: [
        { key: 'jsonkey', value: JSON.stringify({ '<img src=x onerror=alert(1)>': '<img src=x onerror=alert(1)>' }) },
      ],
    });
    const values = screen.getAllByText(/onerror=alert/);
    expect(values[0].innerHTML).toBe('"&lt;img src=x onerror=alert(1)&gt;":');
    expect(values[1].innerHTML).toBe('"&lt;img src=x onerror=alert(1)&gt;"');
  });
});
