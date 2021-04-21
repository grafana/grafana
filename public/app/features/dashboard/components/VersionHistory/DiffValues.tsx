import React from 'react';
import { isArray, isObject, isUndefined } from 'lodash';
import { useStyles, Icon } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { Diff } from './utils';

type DiffProps = {
  diff: Diff;
};

export const DiffValues: React.FC<DiffProps> = ({ diff }) => {
  const styles = useStyles(getStyles);
  const hasLeftValue =
    !isUndefined(diff.originalValue) && !isArray(diff.originalValue) && !isObject(diff.originalValue);
  const hasRightValue = !isUndefined(diff.value) && !isArray(diff.value) && !isObject(diff.value);

  return (
    <>
      {hasLeftValue && <span className={styles}>{String(diff.originalValue)}</span>}
      {hasLeftValue && hasRightValue ? <Icon name="arrow-right" /> : null}
      {hasRightValue && <span className={styles}>{String(diff.value)}</span>}
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => css`
  background-color: ${theme.v2.palette.action.hover};
  border-radius: ${theme.border.radius.md};
  color: ${theme.colors.textHeading};
  font-size: ${theme.typography.size.base};
  margin: 0 ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
`;
