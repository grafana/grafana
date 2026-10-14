import kbn from 'app/core/utils/kbn';

import { createRelativeUrl } from '../../utils/url';

/** Link to the folder's alert-rule view; falls back to the uid when the title has no URL-safe characters. */
export function makeFolderRulesLink(folderUid: string, title: string): string {
  const slug = kbn.slugifyForUrl(title).replace(/^-+|-+$/g, '') || folderUid;
  return createRelativeUrl(`/dashboards/f/${folderUid}/${slug}/alerting`);
}
