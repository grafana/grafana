import React, { FC, MouseEvent, useCallback } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles } from '@grafana/ui';

import { TagBadge } from '../../../core/components/TagFilter/TagBadge';

interface Props {
  tags?: string[];
  remove?: boolean;
  onClick: (tag: string, remove?: boolean) => void;
}

export const AnnotationListItemTags: FC<Props> = ({ tags, remove, onClick }) => {
  const styles = useStyles(getStyles);
  const onTagClicked = useCallback(
    (e: MouseEvent, tag: string) => {
      e.stopPropagation();
      onClick(tag, remove);
    },
    [onClick, remove]
  );

  if (!tags || !tags.length) {
    return null;
  }

  return (
    <>
      {tags.map((tag) => {
        return (
          <span key={tag} onClick={(e) => onTagClicked(e, tag)} className={styles.pointer}>
            <TagBadge label={tag} removeIcon={Boolean(remove)} count={0} />
          </span>
        );
      })}
    </>
  );
};

function getStyles(theme: GrafanaTheme) {
  return {
    pointer: css`
      cursor: pointer;
      padding: ${theme.spacing.xxs};
    `,
  };
}
