import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';

export const DatasourceSuggestions = () => {
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
        <Card onClick={onUseDatasourceSuggestion} key={index}>
          <Card.Description>{item.name}</Card.Description>
        </Card>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  suggestionsWrapper: css`
    display: flex;
    gap: 10px;
  `,
});
