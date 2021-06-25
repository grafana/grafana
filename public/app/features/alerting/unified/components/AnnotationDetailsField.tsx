import React, { FC } from 'react';
import { Well } from './Well';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { Tooltip, useStyles } from '@grafana/ui';
import { DetailsField } from './DetailsField';
import { Annotation, annotationLabels } from '../utils/constants';

const wellableAnnotationKeys = ['message', 'description'];

interface Props {
  annotationKey: string;
  value: string;
}

export const AnnotationDetailsField: FC<Props> = ({ annotationKey, value }) => {
  const label = annotationLabels[annotationKey as Annotation] ? (
    <Tooltip content={annotationKey} placement="top" theme="info">
      <span>{annotationLabels[annotationKey as Annotation]}</span>
    </Tooltip>
  ) : (
    annotationKey
  );

  return (
    <DetailsField label={label} horizontal={true}>
      <AnnotationValue annotationKey={annotationKey} value={value} />
    </DetailsField>
  );
};

const AnnotationValue: FC<Props> = ({ annotationKey, value }) => {
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
