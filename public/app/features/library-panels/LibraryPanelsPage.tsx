import { useState } from 'react';

import { Page } from 'app/core/components/Page/Page';
import { useUrlParams } from 'app/core/navigation/hooks';
import { NavID } from 'app/core/navtree/constants';
import { useDashboardsPageNav } from 'app/features/browse-dashboards/hooks/useDashboardsPageNav';
import { PreviewBannerViewPR } from 'app/features/provisioning/components/Shared/PreviewBannerViewPR';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { LibraryPanelsSearch } from './components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from './components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { type LibraryElementDTO } from './types';

export const LibraryPanelsPage = () => {
  const [selected, setSelected] = useState<LibraryElementDTO | undefined>(undefined);
  const pageNav = useDashboardsPageNav(NavID.dashboardsLibraryPanels);
  const { newPrURL, repoURL } = usePullRequestParam();
  const [urlParams] = useUrlParams();
  const branchInfo = {
    targetBranch: urlParams.get('ref') || undefined,
    configuredBranch: urlParams.get('repo_branch') || undefined,
    repoBaseUrl: repoURL,
  };

  return (
    <Page navId={NavID.dashboardsLibraryPanels} pageNav={pageNav}>
      <Page.Contents>
        {newPrURL && <PreviewBannerViewPR prURL={newPrURL} isNewPr repoUrl={repoURL} branchInfo={branchInfo} />}
        <LibraryPanelsSearch onClick={setSelected} showSecondaryActions showSort showPanelFilter showFolderFilter />
        {selected ? <OpenLibraryPanelModal onDismiss={() => setSelected(undefined)} libraryPanel={selected} /> : null}
      </Page.Contents>
    </Page>
  );
};

export default LibraryPanelsPage;
