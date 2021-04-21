import React from 'react';
import _ from 'lodash';
import { useStyles2, Icon } from '@grafana/ui';
import { GrafanaThemeV2 } from '@grafana/data';
import { css } from '@emotion/css';
import { Diff } from './utils';

type DiffProps = {
  diff: Diff;
};

export const DiffValues: React.FC<DiffProps> = ({ diff }) => {
  const styles = useStyles2(getStyles);
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

const getStyles = (theme: GrafanaThemeV2) => css`
  background-color: ${theme.palette.action.hover};
  border-radius: ${theme.shape.borderRadius()};
  color: ${theme.palette.text.primary};
  font-size: ${theme.typography.body.fontSize};
  margin: 0 ${theme.spacing(0.5)};
  padding: ${theme.spacing(0.5, 1)};
`;
