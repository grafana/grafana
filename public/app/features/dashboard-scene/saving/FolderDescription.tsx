import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { type GrafanaTheme2, renderMarkdown, textUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useGetFolderQuery } from 'app/api/clients/folder/v1beta1';
import { isRootFolderUID } from 'app/features/search/constants';

interface Props {
  folderUid?: string;
}

/** The picked folder's markdown description, shown under the folder picker of a save form */
export function FolderDescription({ folderUid }: Props) {
  const styles = useStyles2(getStyles);
  // Same query and args as the drawer's repository lookup, so with provisioning on this reuses its cached folder
  const { currentData: folder } = useGetFolderQuery(
    folderUid && !isRootFolderUID(folderUid) ? { name: folderUid } : skipToken
  );
  const description = folder?.spec.description;
  const html = useMemo(() => (description ? renderDescription(description) : ''), [description]);

  if (!html) {
    return null;
  }

  return <div className={styles.description} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderDescription(description: string): string {
  const doc = new DOMParser().parseFromString(renderMarkdown(description, { noSanitize: true }), 'text/html');
  // A link must not navigate this tab away from the dashboard being saved
  doc.querySelectorAll('a').forEach((a) => a.setAttribute('target', '_blank'));
  return textUtil.sanitize(doc.body.innerHTML);
}

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    'p:last-child': {
      marginBottom: 0,
    },
    'ul, ol': {
      paddingLeft: theme.spacing(2),
    },
    ul: {
      listStyle: 'disc',
    },
    a: {
      color: theme.colors.text.link,
      textDecoration: 'underline',
    },
  }),
});
