import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, CoreApp } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { FlameGraphTopWrapper } from 'app/plugins/panel/flamegraph/components/FlameGraphTopWrapper';

interface Props {
  dataFrames: DataFrame[];
}

export const FlameGraphExploreContainer = (props: Props) => {
  const styles = useStyles2((theme) => getStyles(theme));

  return (
    <div className={styles.container}>
      <FlameGraphTopWrapper data={props.dataFrames[0]} app={CoreApp.Explore} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background: ${theme.colors.background.primary};
    display: flow-root;
    padding: 0 ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)};
    border: 1px solid ${theme.components.panel.borderColor};
    border-radius: ${theme.shape.borderRadius(1)};
  `,
});
