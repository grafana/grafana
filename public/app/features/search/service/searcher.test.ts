import { toDataFrame } from '@grafana/data';
import { rawIndexSupplier } from './backend';
import { MiniSearcher } from './minisearcher';

describe('simple search', () => {
  it('should support frontend search', async () => {
    const supplier: rawIndexSupplier = () =>
      Promise.resolve({
        dashboard: toDataFrame([
          { Name: 'A name (dash)', Description: 'A descr (dash)' },
          { Name: 'B name (dash)', Description: 'B descr (dash)' },
        ]),
        panel: toDataFrame([
          { Name: 'A name (panels)', Description: 'A descr (panels)' },
          { Name: 'B name (panels)', Description: 'B descr (panels)' },
        ]),
      });

    const searcher = new MiniSearcher(supplier);
    let results = await searcher.search('name');
    expect(results.body.fields[1].values.toArray()).toMatchInlineSnapshot(`
      Array [
        "A name (dash)",
        "B name (dash)",
        "A name (panels)",
        "B name (panels)",
      ]
    `);

    results = await searcher.search('B');
    expect(results.body.fields[1].values.toArray()).toMatchInlineSnapshot(`
      Array [
        "B name (dash)",
        "B name (panels)",
      ]
    `);

    // All fields must have display set
    for (const field of results.body.fields) {
      expect(field.display).toBeDefined();
    }

    // Empty search has defined values
    results = await searcher.search('');
    for (const field of results.body.fields) {
      expect(field.display).toBeDefined();
    }
  });
});
