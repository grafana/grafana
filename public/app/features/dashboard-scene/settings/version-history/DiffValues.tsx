import { css } from '@emotion/css';
import { isArray, isObject, isUndefined } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';

import { Diff } from './utils';

type DiffProps = {
  diff: Diff;
};

export const DiffValues = ({ diff }: DiffProps) => {
  const styles = useStyles2(getStyles);
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

const getStyles = (theme: GrafanaTheme2) =>
  css({
    backgroundColor: theme.colors.action.hover,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    margin: theme.spacing(0, 0.5),
    padding: theme.spacing(0.25, 0.5),
  });
