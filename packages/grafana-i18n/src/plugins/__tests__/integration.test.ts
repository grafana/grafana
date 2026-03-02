import { extract, type I18nextToolkitConfig } from 'i18next-cli';
import { join } from 'node:path';

import { duplicateKeyCheckPlugin } from '../duplicate-key-check';

const FIXTURES = join(__dirname, 'fixtures');

async function runFixture(name: string): Promise<string[]> {
  const reportedConflicts: string[] = [];

  const config: I18nextToolkitConfig = {
    locales: ['en-US'],
    extract: {
      input: [join(FIXTURES, name, 'src/**/*.{ts,tsx}')],
      output: join(FIXTURES, name, '.out/{{language}}/{{namespace}}.json'),
      defaultNS: 'grafana',
      functions: ['t', '*.t'],
      transComponents: ['Trans'],
    },
    plugins: [
      duplicateKeyCheckPlugin({
        failOnConflict: false,
      }),
    ],
  };

  const original = console.warn;
  console.warn = (msg: string) => {
    const keyMatches = msg.matchAll(/Key: "([^"]+)"/g);
    for (const m of keyMatches) {
      reportedConflicts.push(m[1]);
    }
  };

  try {
    await extract(config);
  } finally {
    console.warn = original;
  }

  return reportedConflicts.sort();
}

describe('duplicate-key-check plugin', () => {
  it('reports no conflicts when all defaults match', async () => {
    const conflicts = await runFixture('no-conflict');
    expect(conflicts).toEqual([]);
  });

  it('reports conflict for t() calls with different defaults', async () => {
    const conflicts = await runFixture('simple-t-conflict');
    expect(conflicts).toEqual(['grafana:button.save']);
  });

  it('reports conflict for Trans components with different children', async () => {
    const conflicts = await runFixture('trans-conflict');
    expect(conflicts).toEqual(['grafana:welcome']);
  });

  it('reports conflict when t() and Trans disagree on the same key', async () => {
    const conflicts = await runFixture('mixed-conflict');
    expect(conflicts).toEqual(['grafana:welcome']);
  });

  it('reports conflict when t() and Trans disagree on the same key', async () => {
    const conflicts = await runFixture('advanced-mixed-conflict');
    expect(conflicts).toEqual([]);
  });

  it('ignores t() calls with no defaultValue', async () => {
    const conflicts = await runFixture('no-default');
    expect(conflicts).toEqual([]);
  });

  it('handles explicit namespace prefixes and does not cross namespaces', async () => {
    const conflicts = await runFixture('namespace-explicit');
    expect(conflicts).toEqual(['common:button.save']);
  });
});
