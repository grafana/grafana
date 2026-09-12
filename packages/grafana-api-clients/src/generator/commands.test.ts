import { getFilesToFormat } from './commands';
import { variantFor } from './variants';

describe('getFilesToFormat', () => {
  it('formats both package registration files along with client and export files', () => {
    expect(getFilesToFormat(variantFor(false), 'dashboard', 'v0alpha1')).toEqual([
      'packages/grafana-api-clients/src/clients/rtkq/dashboard/v0alpha1/baseAPI.ts',
      'packages/grafana-api-clients/src/clients/rtkq/dashboard/v0alpha1/index.ts',
      'packages/grafana-api-clients/src/scripts/generate-rtk-apis.ts',
      'packages/grafana-api-clients/src/index.ts',
      'packages/grafana-api-clients/src/clients/rtkq/index.ts',
      'packages/grafana-api-clients/src/clients/rtkq/registration.ts',
      'packages/grafana-api-clients/package.json',
    ]);
  });

  it('formats only client files and the codegen script for enterprise', () => {
    expect(getFilesToFormat(variantFor(true), 'dashboard', 'v0alpha1')).toEqual([
      'public/app/extensions/api/clients/dashboard/v0alpha1/baseAPI.ts',
      'public/app/extensions/api/clients/dashboard/v0alpha1/index.ts',
      'local/generate-enterprise-apis.ts',
    ]);
  });
});
