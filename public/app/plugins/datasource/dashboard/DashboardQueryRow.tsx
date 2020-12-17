import React, { ReactElement } from 'react';
import { css } from 'emotion';
import { Icon, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

import { ResultInfo } from './types';

interface Props {
  editURL: string;
  target: ResultInfo;
}

export function DashboardQueryRow({ editURL, target }: Props): ReactElement {
  const style = useStyles(getStyles);

  return (
    <div className={style.queryEditorRowHeader}>
      <div>
        <img src={target.img} width={16} className={style.logo} />
        <span>{`${target.refId}:`}</span>
      </div>
      <div>
        <a href={editURL}>
          {target.query}
          &nbsp;
          <Icon name="external-link-alt" />
        </a>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme) {
  return {
    logo: css`
      label: logo;
      margin-right: ${theme.spacing.sm};
    `,
    queryEditorRowHeader: css`
      label: queryEditorRowHeader;
      display: flex;
      padding: 4px 8px;
      flex-flow: row wrap;
      background: ${theme.colors.bg2};
      align-items: center;
    `,
  };
}
