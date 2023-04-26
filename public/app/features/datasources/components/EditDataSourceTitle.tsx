import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      marginLeft: theme.spacing(1),
    }),
  };
};

interface Props {
  uid: string;
  title: string;
}

export function EditDataSourceTitle({ title, uid }: Props) {
  const styles = useStyles2(getStyles);

  return <div>{title} - This is going to be title, which is now long but can be edited later.</div>;
}
