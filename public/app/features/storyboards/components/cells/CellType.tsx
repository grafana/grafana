import React from 'react';
import { StoryboardDocumentElement } from '../../types';
import { Icon, Tag } from '@grafana/ui';
import { css } from '@emotion/css';

export function CellType({ element }: { element: StoryboardDocumentElement }): JSX.Element {
  return (
    <span>
      <Tag name={`#${element.id}`} />{' '}
      <Icon
        name="pen"
        className={css`
          cursor: pointer;
        `}
      />
    </span>
  );
}
