import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { Annotation, annotationLabels } from '../utils/constants';

import { DetailsField } from './DetailsField';
import { Tokenize } from './Tokenize';
import { Well } from './Well';

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
  const styles = useStyles2(getStyles);

  const needsWell = wellableAnnotationKeys.includes(annotationKey);
  const needsLink = value && value.startsWith('http');

  const tokenizeValue = <Tokenize input={value} delimiter={['{{', '}}']} />;

  if (needsWell) {
    return <Well className={styles.well}>{tokenizeValue}</Well>;
  }

  if (needsLink) {
    return (
      <a href={value} target="__blank" className={styles.link}>
        {value}
      </a>
    );
  }

  return <>{tokenizeValue}</>;
};

export const getStyles = (theme: GrafanaTheme2) => ({
  well: css`
    word-break: break-word;
  `,
  link: css`
    word-break: break-all;
    color: ${theme.colors.primary.text};
  `,
});
