import { MOCK_APP_KIND } from '@grafana/test-utils/unstable';
import { addKinds } from 'app/core/kinds/coreKinds';

/**
 * Adds the app kind the mock server serves (`MOCK_APP_KIND`) to the kind registry, as its plugin would, before the
 * tests of the file. An object of the kind has its page at `/a/test-things-app/things/<name>`, its icon is `cube`
 * and its label "Thing". The registry is the test file's own and takes no kind out again, so the kind stays for
 * every test of the file.
 */
export const testWithAppKind = () => {
  beforeAll(() => {
    addKinds([
      {
        group: MOCK_APP_KIND.group,
        kind: MOCK_APP_KIND.kind,
        resource: MOCK_APP_KIND.resource,
        folderScoped: false,
        getLabel: () => 'Thing',
        getPluralLabel: () => 'Things',
        icon: 'cube',
        getRoute: (name) => `/a/test-things-app/things/${encodeURIComponent(name)}`,
      },
    ]);
  });
};
