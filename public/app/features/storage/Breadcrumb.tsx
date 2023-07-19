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
        <li>
          <Icon name={rootIcon} onClick={() => onPathChange('')} />
        </li>
      )}
      {paths.map((path, index) => {
        let url = '/' + paths.slice(0, index + 1).join('/');
        const onClickBreadcrumb = () => onPathChange(url);
        const isLastBreadcrumb = index === paths.length - 1;
        return (
          // TODO: fix keyboard a11y
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li key={uniqueId(path)} onClick={isLastBreadcrumb ? undefined : onClickBreadcrumb}>
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
