import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VizLegendSeriesIcon } from '@grafana/ui/src/components/VizLegend/VizLegendSeriesIcon';

import { Page } from '../Page/Page';

export function ErrorPage() {
  const styles = useStyles2(getStyles);

  return (
    <Page navId="home" layout={PageLayoutType.Canvas} pageNav={{ text: 'Page not found' }}>
      <div className={styles.container}>
        <h1>Page not found</h1>
        <div className={styles.subtitle}>
          We could not find the page you are looking for. If the issue persists seek help on the{' '}
          <a href="https://community.grafana.com" target="_blank" rel="noreferrer" className="error-link">
            community site.
          </a>
        </div>

        <div className={styles.panel}>
          <div className="error-row">
            <div className="error-column error-space-between graph-percentage">
              <p>100%</p>
              <p>80%</p>
              <p>60%</p>
              <p>40%</p>
              <p>20%</p>
              <p>0%</p>
            </div>
            <div className="error-column image-box">
              <img src="public/img/graph404.svg" width="100%" alt="graph" />
              <div className="error-row error-space-between">
                <p className="graph-text">Then</p>
                <p className="graph-text">Now</p>
              </div>
            </div>
          </div>
          <div className={styles.legend}>
            <VizLegendSeriesIcon seriesName="asd" color="green" />
            <div>Chances you are on the page you are looking for (Last: 0%)</div>
          </div>
        </div>
      </div>
    </Page>
  );
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(4),
    }),
    subtitle: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
    }),
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '874px',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.borderRadius(),
      padding: theme.spacing(2),
      background: theme.colors.background.primary,
    }),
    legend: css({
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
    }),
  };
}
