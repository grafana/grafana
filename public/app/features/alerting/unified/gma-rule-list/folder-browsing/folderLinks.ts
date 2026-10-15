import kbn from 'app/core/utils/kbn';

import { createRelativeUrl } from '../../utils/url';

export function makeFolderRulesLink(folderUid: string, title: string): string {
  const slug = kbn.slugifyForUrl(title).replace(/^-+|-+$/g, '') || folderUid;
  return createRelativeUrl(`/dashboards/f/${folderUid}/${slug}/alerting`);
}
