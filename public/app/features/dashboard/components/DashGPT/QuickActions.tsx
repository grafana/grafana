import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const QuickActions = () => {
  const styles = useStyles2(getStyles);

  const datasourceSuggestions = [
    {
      name: 'Graphite Templated Nested',
      id: 'graphite',
    },
    {
      name: 'Influx 2.2: Live NOAA Buoy Data',
      id: 'influxdb',
    },
    {
      name: 'Loki NGINX Service Mesh',
      id: 'loki',
    },
  ];

  const onUseDatasourceSuggestion = () => {
    // @TODO: Implement
    console.log('onUseDatasourceSuggestion');
  };

  return (
    <div className={styles.suggestionsWrapper}>
      {datasourceSuggestions.map((item, index) => (
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className={styles.suggestion} key={index} onClick={onUseDatasourceSuggestion}>
            {item.name}
          </div>
        </>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  suggestionsWrapper: css`
    display: flex;
    gap: 10px;
  `,
  suggestion: css`
    padding: 10px;
    border: 1px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
    color: ${theme.colors.text.secondary};
    cursor: pointer;
  `,
});
