import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

type Props = {
  description: string;
  suffix: string;
  feature: string;
};

export function ConfigDescriptionLink(props: Props) {
  const { description, suffix, feature } = props;
  const text = `Learn more about ${feature}`;
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.container}>
      {description}
      <a
        aria-label={text}
        href={`https://grafana.com/docs/grafana/next/datasources/${suffix}`}
        rel="noreferrer"
        target="_blank"
      >
        {text}
      </a>
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      color: theme.colors.text.secondary,
      a: css({
        color: theme.colors.text.link,
        textDecoration: 'underline',
        marginLeft: '5px',
        '&:hover': {
          textDecoration: 'none',
        },
      }),
    }),
  };
};
