import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconName, useStyles2 } from '@grafana/ui';

interface Props {
  rootIcon?: IconName;
  pathName: string;
  onPathChange: (path: string) => void;
}

export function Breadcrumb({ pathName, onPathChange, rootIcon }: Props) {
  const styles = useStyles2(getStyles);
  const paths = pathName.split('/').filter(Boolean);

  return (
    <ul className={styles.breadCrumb}>
      {rootIcon && (
        <li onClick={() => onPathChange('')}>
          <Icon name={rootIcon} />
        </li>
      )}
      {paths.map((path, index) => {
        let url = '/' + paths.slice(0, index + 1).join('/');
        return (
          <li
            key={uniqueId(path)}
            onClick={() => {
              // Don't change path if it's the last part
              if (index === paths.length - 1) {
                return;
              }
              onPathChange(url);
            }}
          >
            {path}
          </li>
        );
      })}
    </ul>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    breadCrumb: css`
      list-style: none;
      padding: ${theme.spacing(2, 1)};

      li {
        display: inline;

        :not(:last-child) {
          color: ${theme.colors.text.link};
          cursor: pointer;
        }
        + li:before {
          content: '>';
          padding: ${theme.spacing(1)};
          color: ${theme.colors.text.secondary};
        }
      }
    `,
  };
}
