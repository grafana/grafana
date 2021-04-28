import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { AlertLabel } from './AlertLabel';
import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';

type LabelsProps = { labels: Record<string, string>; onRemoveLabel?: (index: number) => void; matchers?: never };
type MatchersProps = { matchers: SilenceMatcher[]; onRemoveLabel?: (index: number) => void; labels?: never };

type Props = LabelsProps | MatchersProps;

export const AlertLabels = ({ labels, matchers, onRemoveLabel }: Props) => {
  const styles = useStyles(getStyles);

  const removeLabel = useCallback(
    (index: number) => {
      if (!!onRemoveLabel) {
        onRemoveLabel(index);
      }
    },
    [onRemoveLabel]
  );

  if (labels) {
    const pairs = Object.entries(labels).filter(([key]) => !(key.startsWith('__') && key.endsWith('__')));

    return (
      <div className={styles.wrapper}>
        {pairs.map(([key, value]) => (
          <AlertLabel key={`${key}-${value}`} labelKey={key} value={value} />
        ))}
      </div>
    );
  }
  if (matchers) {
    return (
      <div className={styles.wrapper}>
        {matchers.map(({ name, value, isRegex }: SilenceMatcher, index) => {
          return (
            <AlertLabel
              key={`${name}-${value}`}
              labelKey={name}
              value={value}
              isRegex={isRegex}
              onRemoveLabel={!!onRemoveLabel ? () => removeLabel(index) : undefined}
            />
          );
        })}
      </div>
    );
  }
  return null;
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
