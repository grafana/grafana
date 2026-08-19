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
import userEvent from '@testing-library/user-event';

import { reportInteraction } from '@grafana/runtime';

import KeyValuesTable, { LinkValue, type KeyValuesTableProps } from './KeyValuesTable';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    buildInfo: {
      version: '11.0.0',
    },
  },
}));

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
  return render(<KeyValuesTable {...(props as KeyValuesTableProps)} />);
};

describe('LinkValue', () => {
  beforeEach(() => {
    (reportInteraction as jest.Mock).mockClear();
  });

  it('renders as expected', () => {
    const link = {
      title: 'titleValue',
      path: 'hrefValue',
    };
    const childrenText = 'childrenTextValue';
    render(<LinkValue link={link}>{childrenText}</LinkValue>);
    const linkEl = screen.getByRole('link', { name: 'titleValue' });
    expect(linkEl).toBeInTheDocument();
    expect(screen.getByText(/^childrenTextValue$/)).toBeInTheDocument();
    expect(linkEl.querySelector('svg')).toBeInTheDocument();
    expect(linkEl.firstChild).toBe(linkEl.querySelector('svg'));
  });

  it('renders a custom icon to the left of the value', () => {
    const link = {
      title: 'titleValue',
      path: 'hrefValue',
      icon: 'asserts' as const,
    };
    render(<LinkValue link={link}>childrenTextValue</LinkValue>);
    const linkEl = screen.getByRole('link', { name: 'titleValue' });
    expect(linkEl.firstChild).toBe(linkEl.querySelector('svg'));
  });

  it('reports an interaction when clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const link = {
      title: 'View in Asserts',
      path: 'http://example.com/asserts',
      pluginId: 'grafana-asserts-app',
      group: { name: 'service.name' },
      category: 'service.name',
      onClick,
    };
    render(
      <LinkValue link={link} datasourceType="tempo">
        value
      </LinkValue>
    );

    await user.click(screen.getByRole('link', { name: 'View in Asserts' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_resource_link_clicked', {
      grafana_version: '11.0.0',
      datasourceType: 'tempo',
      pluginId: 'grafana-asserts-app',
      group: 'service.name',
      category: 'service.name',
      location: 'value',
    });
    expect(onClick).toHaveBeenCalled();
  });
});

describe('KeyValuesTable tests', () => {
  beforeEach(() => {
    (reportInteraction as jest.Mock).mockClear();
  });

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
                path: `http://example.com/?kind=${encodeURIComponent(array[i].value)}`,
                title: `More info about ${array[i].value}`,
                icon: 'asserts',
              },
            ]
          : [],
    });

    const link = screen.getByRole('link', { name: 'More info about client' });
    expect(link).toBeInTheDocument();
    expect(link.firstChild).toBe(link.querySelector('svg'));
    expect(screen.getByRole('row', { name: 'span.kind More info about client' })).toBeInTheDocument();
  });

  it('reports an interaction when a single resource link is clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    setup({
      datasourceType: 'tempo',
      linksGetter: (array, i) =>
        array[i].key === 'span.kind'
          ? [
              {
                path: 'http://example.com/docs',
                title: 'More info about client',
                pluginId: 'grafana-asserts-app',
                group: { name: 'span.kind' },
                onClick,
              },
            ]
          : [],
    });

    await user.click(screen.getByRole('link', { name: 'More info about client' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_resource_link_clicked', {
      grafana_version: '11.0.0',
      datasourceType: 'tempo',
      pluginId: 'grafana-asserts-app',
      group: 'span.kind',
      category: undefined,
      location: 'value',
    });
    expect(onClick).toHaveBeenCalled();
  });

  it('renders a dropdown menu when multiple links are available', async () => {
    const user = userEvent.setup();
    setup({
      linksGetter: (array, i) =>
        array[i].key === 'span.kind'
          ? [
              {
                path: 'http://example.com/docs',
                title: 'Docs',
                description: 'Documentation',
                icon: 'book',
              },
              {
                path: 'http://example.com/dashboard',
                title: 'Dashboard',
                description: 'Service dashboard',
                icon: 'apps',
              },
            ]
          : [],
    });

    expect(screen.queryByRole('link', { name: 'Documentation' })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /span\.kind.*"client"/ })).toBeInTheDocument();

    // Accessible name comes from the associated value label, not a generic aria-label
    await user.click(screen.getByRole('button', { name: /"client"/ }));

    expect(await screen.findByText('OPEN VALUE IN')).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Service dashboard' })).toBeInTheDocument();
    expect(screen.getByTitle('Docs')).toBeInTheDocument();
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
  });

  it('reports an interaction when a menu resource link is clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    setup({
      datasourceType: 'tempo',
      linksGetter: (array, i) =>
        array[i].key === 'span.kind'
          ? [
              {
                path: 'http://example.com/docs',
                title: 'Docs',
                description: 'Documentation',
                pluginId: 'grafana-asserts-app',
                group: { name: 'span.kind' },
                onClick,
              },
              {
                path: 'http://example.com/dashboard',
                title: 'Dashboard',
                description: 'Service dashboard',
                pluginId: 'grafana-other-app',
                group: { name: 'span.kind' },
              },
            ]
          : [],
    });

    await user.click(screen.getByRole('button', { name: /"client"/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Documentation' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_resource_link_clicked', {
      grafana_version: '11.0.0',
      datasourceType: 'tempo',
      pluginId: 'grafana-asserts-app',
      group: 'span.kind',
      category: undefined,
      location: 'menu',
    });
    expect(onClick).toHaveBeenCalled();
  });

  it('opens the dropdown when clicking the attribute value text', async () => {
    const user = userEvent.setup();
    setup({
      linksGetter: (array, i) =>
        array[i].key === 'span.kind'
          ? [
              {
                path: 'http://example.com/docs',
                title: 'Docs',
                description: 'Documentation',
              },
              {
                path: 'http://example.com/dashboard',
                title: 'Dashboard',
                description: 'Service dashboard',
              },
            ]
          : [],
    });

    await user.click(screen.getByText(/"client"/));

    expect(await screen.findByRole('menuitem', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Service dashboard' })).toBeInTheDocument();
  });

  it('renders a <CopyIcon /> for each data element', () => {
    setup();

    expect(screen.getAllByRole('button', { hidden: true })).toHaveLength(4);
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

  it('wraps matching values with the attribute plugin promo tip', async () => {
    const user = userEvent.setup();
    setup({
      data: [
        { key: 'db.system', value: 'postgresql' },
        { key: 'http.method', value: 'GET' },
      ],
      promoGetter: (key) =>
        key.startsWith('db.')
          ? {
              pluginId: 'grafana-dbo11y-app',
              icon: 'database-observability',
              title: 'Find slow queries faster',
              body: 'Database Observability surfaces visual explain plans, wait events, and query samples.',
              match: () => true,
            }
          : undefined,
    });

    expect(screen.getByText('"postgresql"')).toBeInTheDocument();
    expect(screen.getByTestId('attribute-plugin-promo-trigger')).toBeInTheDocument();
    expect(screen.queryByText('Find slow queries faster')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('attribute-plugin-promo-trigger'));
    expect(await screen.findByText('Find slow queries faster')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /learn more/i })).toBeInTheDocument();
  });

  it('does not wrap values when they already have a plugin link', () => {
    setup({
      data: [{ key: 'db.query.text', value: 'SELECT 1' }],
      promoGetter: () => ({
        pluginId: 'grafana-dbo11y-app',
        icon: 'database-observability',
        title: 'Find slow queries faster',
        body: 'body',
        match: () => true,
      }),
      linksGetter: () => [
        {
          path: '/a/grafana-dbo11y-app/overview',
          title: 'View Query Details',
          icon: 'database',
        },
      ],
    });

    expect(screen.getByRole('link', { name: 'View Query Details' })).toBeInTheDocument();
    expect(screen.queryByTestId('attribute-plugin-promo-trigger')).not.toBeInTheDocument();
  });

  it('does not wrap values that are auto-linkified urls', () => {
    setup({
      data: [{ key: 'db.connection_string', value: 'https://example.com/db' }],
      promoGetter: () => ({
        pluginId: 'grafana-dbo11y-app',
        icon: 'database-observability',
        title: 'Find slow queries faster',
        body: 'body',
        match: () => true,
      }),
    });

    expect(screen.getByRole('link', { name: 'https://example.com/db' })).toBeInTheDocument();
    expect(screen.queryByTestId('attribute-plugin-promo-trigger')).not.toBeInTheDocument();
  });
});
