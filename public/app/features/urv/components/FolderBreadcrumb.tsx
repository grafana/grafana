import { css } from '@emotion/css';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { Breadcrumbs } from 'app/core/components/Breadcrumbs/Breadcrumbs';
import { type Breadcrumb } from 'app/core/components/Breadcrumbs/types';

import { folderHref } from '../hooks/useUrvState';

export interface FolderCrumb {
  /** A folder uid, NO_FOLDER, ROOT_LEVEL or ALL_FOLDERS. */
  folder: string;
  title: string;
}

interface Props {
  /** Root first, ending with the selected place. */
  path: FolderCrumb[];
}

export function FolderBreadcrumb({ path }: Props) {
  const styles = useStyles2(getStyles);
  const [params] = useSearchParams();

  const breadcrumbs: Breadcrumb[] = [
    { text: t('urv.page.title', 'Resources'), href: folderHref(params, undefined) },
    ...path.map(({ folder, title }) => ({ text: title, href: folderHref(params, folder) })),
  ];

  return <Breadcrumbs breadcrumbs={breadcrumbs} className={styles.breadcrumbs} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Line the first crumb up with the page title.
  breadcrumbs: css({
    marginLeft: theme.spacing(-0.5),
  }),
});
