import { css } from '@emotion/css';
import React from 'react';

import { useTheme2 } from '@grafana/ui';

type Props = {
  dataSourceName: string;
  docsLink?: string;
  hasRequiredFields?: boolean;
};

export const DataSourceDescription: React.FC<Props> = ({ dataSourceName, docsLink, hasRequiredFields = false }) => {
  const theme = useTheme2();

  const styles = {
    container: css({
      margin: theme.spacing(4, 0),
    }),
    text: css({
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      a: css({
        color: theme.colors.text.link,
        textDecoration: 'underline',
        '&:hover': {
          textDecoration: 'none',
        },
      }),
    }),
    asterisk: css`
      color: ${theme.colors.error.main};
    `,
  };

  return (
    <div className={styles.container}>
      <p className={styles.text}>
        Before you can use the {dataSourceName} data source, you must configure it below or in the config file.
        {docsLink && (
          <>
            <br />
            For detailed instructions,{' '}
            <a href={docsLink} target="_blank" rel="noreferrer">
              view the documentation
            </a>
            .
          </>
        )}
      </p>
      {hasRequiredFields && (
        <p className={styles.text}>
          <i>
            Fields marked in <span className={styles.asterisk}>*</span> are required
          </i>
        </p>
      )}
    </div>
  );
};
