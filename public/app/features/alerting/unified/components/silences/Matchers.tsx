import React, { useCallback } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';
import { AlertLabel } from '../AlertLabel';

type MatchersProps = { matchers: SilenceMatcher[]; onRemoveLabel?(index: number): void };

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
      {matchers.map(({ name, value, isRegex }: SilenceMatcher, index) => {
        return (
          <AlertLabel
            key={`${name}-${value}-${index}`}
            labelKey={name}
            value={value}
            isRegex={isRegex}
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
