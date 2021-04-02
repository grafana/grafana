import React from 'react';
import _ from 'lodash';
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
    !_.isUndefined(diff.originalValue) && !_.isArray(diff.originalValue) && !_.isObject(diff.originalValue);
  const hasRightValue = !_.isUndefined(diff.value) && !_.isArray(diff.value) && !_.isObject(diff.value);

  return (
    <>
      {hasLeftValue && <span className={styles}>{String(diff.originalValue)}</span>}
      {hasLeftValue && hasRightValue ? <Icon name="arrow-right" /> : null}
      {hasRightValue && <span className={styles}>{String(diff.value)}</span>}
    </>
  );
};

const getStyles = (theme: GrafanaTheme) => css`
  background-color: ${theme.colors.bg3};
  border-radius: ${theme.border.radius.md};
  color: ${theme.colors.textHeading};
  font-size: ${theme.typography.size.base};
  margin: 0 ${theme.spacing.xs};
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
`;
