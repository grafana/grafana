import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { Annotation, annotationLabels } from '../utils/constants';

import { DetailsField } from './DetailsField';
import { Link } from './ExternalLink';
import { Tokenize } from './Tokenize';
import { Well } from './Well';

const wellableAnnotationKeys = ['message', 'description'];

interface Props {
  annotationKey: string;
  value: string;
  valueLink?: string;
}

export const AnnotationDetailsField = ({ annotationKey, value, valueLink }: Props) => {
  const label = annotationLabels[annotationKey as Annotation] ? (
    <Tooltip content={annotationKey} placement="top" theme="info">
      <span>{annotationLabels[annotationKey as Annotation]}</span>
    </Tooltip>
  ) : (
    annotationKey
  );

  return (
    <DetailsField label={label} horizontal={true}>
      <AnnotationValue annotationKey={annotationKey} value={value} valueLink={valueLink} />
    </DetailsField>
  );
};

const AnnotationValue = ({ annotationKey, value, valueLink }: Props) => {
  const styles = useStyles2(getStyles);

  const needsWell = wellableAnnotationKeys.includes(annotationKey);
  const needsExternalLink = value && value.startsWith('http');

  const tokenizeValue = <Tokenize input={value} delimiter={['{{', '}}']} />;

  if (valueLink) {
    return (
      <Link href={valueLink} external>
        {value}
      </Link>
    );
  }

  if (needsWell) {
    return <Well className={styles.well}>{tokenizeValue}</Well>;
  }

  if (needsExternalLink) {
    return (
      <Link href={value} external>
        {value}
      </Link>
    );
  }

  return <>{tokenizeValue}</>;
};

export const getStyles = (theme: GrafanaTheme2) => ({
  well: css`
    word-break: break-word;
  `,
});
