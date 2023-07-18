import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

interface VizTooltipFooterProps {}

const addAnnotation = () => {
  console.log('add annotation');
};

export const VizTooltipFooter = ({}: VizTooltipFooterProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.button}>
        <Button icon="comment-alt" variant="secondary" size="md" onClick={() => console.log('click')}>
          Add annotation
        </Button>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 4px;
    border-top: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(1)} 0;
  `,
  button: css`
    //max-width: 160px;
  `,
});
