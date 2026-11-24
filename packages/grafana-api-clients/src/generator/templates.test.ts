import fs from 'fs';
import path from 'path';

import {
  formatEndpoints,
  renderConfigEntry,
  renderBaseAPI,
  renderIndexTs,
  getRTKClientEntries,
  type TemplateInput,
} from './templates';
import { variantFor } from './variants';

describe('formatEndpoints', () => {
  it('normalises a comma-separated list into single-quoted identifiers', () => {
    expect(formatEndpoints('getFoo, getBar, deleteBaz')).toBe("'getFoo', 'getBar', 'deleteBaz'");
  });

  it('strips surrounding quotes from each identifier', () => {
    expect(formatEndpoints(`"getFoo", 'getBar'`)).toBe("'getFoo', 'getBar'");
  });

  it('drops empty segments caused by trailing commas', () => {
    expect(formatEndpoints('getFoo,,')).toBe("'getFoo'");
  });

  it('returns a single quoted identifier for a single value', () => {
    expect(formatEndpoints('getFoo')).toBe("'getFoo'");
  });
});

describe('renderConfigEntry', () => {
  it('renders a config line with endpoints', () => {
    const result = renderConfigEntry({ groupName: 'dashboard', version: 'v0alpha1', endpoints: 'getFoo, getBar' });
    expect(result).toBe(`  ...createAPIConfig('dashboard', 'v0alpha1', ['getFoo', 'getBar']),`);
  });

  it('renders a config line without endpoints when empty string is given', () => {
    const result = renderConfigEntry({ groupName: 'dashboard', version: 'v1', endpoints: '' });
    expect(result).toBe(`  ...createAPIConfig('dashboard', 'v1'),`);
  });
});

describe('renderBaseAPI', () => {
  const input: TemplateInput = {
    group: 'dashboard.grafana.app',
    groupName: 'dashboard',
    version: 'v0alpha1',
    reducerPath: 'dashboardAPI',
    endpoints: 'getFoo',
  };

  it('includes the group, version and reducerPath in the output', () => {
    const result = renderBaseAPI(input, variantFor(false));
    expect(result).toContain(`export const API_GROUP = 'dashboard.grafana.app' as const;`);
    expect(result).toContain(`export const API_VERSION = 'v0alpha1' as const;`);
    expect(result).toContain(`reducerPath: 'dashboardAPI'`);
  });

  it('uses the variant-specific imports', () => {
    const oss = renderBaseAPI(input, variantFor(false));
    expect(oss).toContain(`import { getAPIBaseURL, resolveAPIBaseURLWithFallback } from '../../../../utils/utils';`);

    const ent = renderBaseAPI(input, variantFor(true));
    expect(ent).toContain(`import { getAPIBaseURL, resolveAPIBaseURLWithFallback } from '@grafana/api-clients';`);
  });

  it('resolves the base URL through discovery and falls back to BASE_URL', () => {
    const result = renderBaseAPI(input, variantFor(false));
    expect(result).toContain(
      'getBaseURL: () => resolveAPIBaseURLWithFallback(API_GROUP, COMPATIBLE_VERSIONS, BASE_URL),'
    );
    expect(result).not.toContain('baseURL: BASE_URL');
  });

  it('lists only the generated version as compatible by default', () => {
    const result = renderBaseAPI(input, variantFor(false));
    expect(result).toContain('export const COMPATIBLE_VERSIONS = [API_VERSION] as const;');
  });

  it('lists the other compatible versions after the generated version without repeating it', () => {
    const result = renderBaseAPI({ ...input, compatibleVersions: ['v1beta1', 'v0alpha1', 'v1'] }, variantFor(false));
    expect(result).toContain(`export const COMPATIBLE_VERSIONS = [API_VERSION, 'v1beta1', 'v1'] as const;`);
  });

  it('renders the committed folder client', () => {
    const folderInput: TemplateInput = {
      group: 'folder.grafana.app',
      groupName: 'folder',
      version: 'v1beta1',
      reducerPath: 'folderAPIv1beta1',
      endpoints: '',
      compatibleVersions: ['v1'],
    };
    const committed = fs.readFileSync(path.join(__dirname, '../clients/rtkq/folder/v1beta1/baseAPI.ts'), 'utf8');

    expect(renderBaseAPI(folderInput, variantFor(false))).toBe(committed);
  });
});

describe('renderIndexTs', () => {
  it('re-exports BASE_URL, API_GROUP, API_VERSION and generatedAPI', () => {
    const result = renderIndexTs();
    expect(result).toContain('export { BASE_URL, API_GROUP, API_VERSION }');
    expect(result).toContain('export const generatedAPI');
  });
});

describe('getRTKClientEntries', () => {
  it('returns import, reducer, and middleware entries for a given client', () => {
    const result = getRTKClientEntries({ groupName: 'dashboard', version: 'v0alpha1', reducerPath: 'dashboardAPI' });

    expect(result).toEqual({
      importEntry: "import { generatedAPI as dashboardAPI } from './dashboard/v0alpha1';",
      reducerEntry: '[dashboardAPI.reducerPath]: dashboardAPI.reducer,',
      middlewareEntry: 'dashboardAPI.middleware,',
    });
  });
});
