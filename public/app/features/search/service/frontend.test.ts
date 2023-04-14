import { toDataFrame, FieldType } from '@grafana/data';

import { DummySearcher } from './dummy';
import { FrontendSearcher } from './frontend';

describe('FrontendSearcher', () => {
  const upstream = new DummySearcher();
  upstream.setExpectedSearchResult(
    toDataFrame({
      meta: {
        custom: {
          something: 8,
        },
      },
      fields: [{ name: 'name', type: FieldType.string, values: ['foo cat', 'bar dog', 'cow baz'] }],
    })
  );

  it('should call search api with correct query for general folder', async () => {
    const frontendSearcher = new FrontendSearcher(upstream);
    const query = {
      query: '*',
      kind: ['dashboard'],
      location: 'General',
    };
    const results = await frontendSearcher.search(query);

    expect(results.view.fields.name.values.toArray()).toMatchInlineSnapshot(`
      [
        "foo cat",
        "bar dog",
        "cow baz",
      ]
    `);
  });

  it('should return correct results for single prefix', async () => {
    const frontendSearcher = new FrontendSearcher(upstream);
    const query = {
      query: 'ba',
      kind: ['dashboard'],
      location: 'General',
    };
    const results = await frontendSearcher.search(query);

    expect(results.view.fields.name.values.toArray()).toMatchInlineSnapshot(`
      [
        "bar dog",
        "cow baz",
      ]
    `);
  });

  it('should return correct results out-of-order prefixes', async () => {
    const frontendSearcher = new FrontendSearcher(upstream);
    const query = {
      query: 'do ba',
      kind: ['dashboard'],
      location: 'General',
    };
    const results = await frontendSearcher.search(query);

    expect(results.view.fields.name.values.toArray()).toMatchInlineSnapshot(`
      [
        "bar dog",
      ]
    `);
  });

  it('should barf when attempting a custom sort strategy', async () => {
    const frontendSearcher = new FrontendSearcher(upstream);
    const query = {
      query: 'ba',
      kind: ['dashboard'],
      location: 'General',
      sort: 'name_sort',
    };

    await expect(frontendSearcher.search(query)).rejects.toThrow('custom sorting is not supported yet');
  });
});
