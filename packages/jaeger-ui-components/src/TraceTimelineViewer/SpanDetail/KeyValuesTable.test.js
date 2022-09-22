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
import React from 'react';

import KeyValuesTable, { LinkValue } from './KeyValuesTable';

const data = [
  { key: 'span.kind', value: 'client' },
  { key: 'omg', value: 'mos-def' },
  { key: 'numericString', value: '12345678901234567890' },
  { key: 'jsonkey', value: JSON.stringify({ hello: 'world' }) },
];

const setup = (propOverrides) => {
  const props = {
    data: data,
    ...propOverrides,
  };
  return render(<KeyValuesTable {...props} />);
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

  it('renders a single link correctly', () => {
    setup({
      linksGetter: (array, i) =>
        array[i].key === 'span.kind'
          ? [
              {
                url: `http://example.com/?kind=${encodeURIComponent(array[i].value)}`,
                text: `More info about ${array[i].value}`,
              },
            ]
          : [],
    });

    expect(screen.getByRole('row', { name: 'span.kind More info about client' })).toBeInTheDocument();
  });

  it('renders a <CopyIcon /> for each data element', () => {
    setup();

    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});
