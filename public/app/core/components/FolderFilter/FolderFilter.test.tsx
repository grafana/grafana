import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { render, screen, testWithFeatureToggles } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { resetGrafanaSearcher } from 'app/features/search/service/searcher';

import { FolderFilter } from './FolderFilter';
const [_, { folderA, folderB }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();
comboboxTestSetup();

const fixtures: Array<
  [
    // Test title
    string,
    // Feature toggle setup
    Parameters<typeof testWithFeatureToggles>[0],
  ]
> = [
  ['app platform APIs enabled', { enable: ['unifiedStorageSearchUI'] }],
  ['app platform APIs disabled', {}],
];

describe.each(fixtures)('FolderFilter - %s', (_title, featureToggleSetup) => {
  beforeEach(() => {
    resetGrafanaSearcher();
  });

  testWithFeatureToggles(featureToggleSetup);

  it('allows selecting folders', async () => {
    const onChange = jest.fn();
    const { user } = render(<FolderFilter onChange={onChange} />);

    await user.click(screen.getByPlaceholderText('Filter by folder'));

    await user.click(await screen.findByText(folderA.item.title));
    await user.click(await screen.findByText(folderB.item.title));
    expect(onChange).toHaveBeenCalledWith([folderA.item.uid, folderB.item.uid]);
  });
});
