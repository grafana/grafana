import React, { FC } from 'react';
import { Well } from './Well';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles } from '@grafana/ui';

const wellableAnnotationKeys = ['message', 'description'];

interface Props {
  annotationKey: string;
  value: string;
}

export const Annotation: FC<Props> = ({ annotationKey, value }) => {
  const styles = useStyles(getStyles);
  if (wellableAnnotationKeys.includes(annotationKey)) {
    return <Well>{value}</Well>;
  } else if (value && value.startsWith('http')) {
    return (
      <a href={value} target="__blank" className={styles.link}>
        {value}
      </a>
    );
  }
  return <>{value}</>;
};

export const getStyles = (theme: GrafanaTheme) => ({
  well: css`
    word-break: break-all;
  `,
  link: css`
    word-break: break-all;
    color: ${theme.colors.textBlue};
  `,
});
