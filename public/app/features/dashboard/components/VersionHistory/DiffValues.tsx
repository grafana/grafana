import React from 'react';
import _ from 'lodash';
import { useStyles, Icon } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

type DiffProps = {
  change: {
    op: 'add' | 'replace' | 'remove';
    value: any;
    originalValue: any;
    path: string[];
  };
};

export const DiffValues: React.FC<DiffProps> = ({ change }) => {
  const styles = useStyles(getStyles);
  const hasLeftValue =
    !_.isUndefined(change.originalValue) && !_.isArray(change.originalValue) && !_.isObject(change.originalValue);
  const hasRightValue = !_.isUndefined(change.value) && !_.isArray(change.value) && !_.isObject(change.value);

  return (
    <>
      {hasLeftValue && <span className={styles}>{String(change.originalValue)}</span>}
      {hasLeftValue && hasRightValue ? <Icon name="arrow-right" /> : null}
      {hasRightValue && <span className={styles}>{String(change.value)}</span>}
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
