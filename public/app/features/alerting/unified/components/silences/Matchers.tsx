import React, { useCallback } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { AlertLabel } from '../AlertLabel';
import { matcherToOperator } from '../../utils/alertmanager';

type MatchersProps = { matchers: Matcher[]; onRemoveLabel?(index: number): void };

export const Matchers = ({ matchers, onRemoveLabel }: MatchersProps) => {
  const styles = useStyles(getStyles);

  const removeLabel = useCallback(
    (index: number) => {
      if (!!onRemoveLabel) {
        onRemoveLabel(index);
      }
    },
    [onRemoveLabel]
  );

  return (
    <div className={styles.wrapper}>
      {matchers.map((matcher, index) => {
        const { name, value } = matcher;
        return (
          <AlertLabel
            key={`${name}-${value}-${index}`}
            labelKey={name}
            value={value}
            operator={matcherToOperator(matcher)}
            onRemoveLabel={!!onRemoveLabel ? () => removeLabel(index) : undefined}
          />
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    & > * {
      margin-top: ${theme.spacing.xs};
      margin-right: ${theme.spacing.xs};
    }
    padding-bottom: ${theme.spacing.xs};
  `,
});
