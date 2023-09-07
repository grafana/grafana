import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const calculateFieldHelper = () => {
    const getStyles = (theme: GrafanaTheme2) => {
      return {
        ulPadding: css({
          margin: theme.spacing(1, 0),
          paddingLeft: theme.spacing(5),
        }),
      };
    };
    
  const styles = useStyles2(getStyles);
};

