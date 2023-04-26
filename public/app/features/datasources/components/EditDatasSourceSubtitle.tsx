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
}

export function EditDataSourceSubtitle({ uid }: Props) {
  const styles = useStyles2(getStyles);

  return <div>Hello world!</div>;
}
