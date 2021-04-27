import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import React, { FC } from 'react';
import { AlertLabel } from './AlertLabel';
import { SilenceMatcher } from 'app/plugins/datasource/alertmanager/types';

type LabelsProps = { labels: Record<string, string>; matchers?: never };
type MatchersProps = { matchers: SilenceMatcher[]; labels?: never };

type Props = LabelsProps | MatchersProps;

export const AlertLabels: FC<Props> = ({ labels, matchers }) => {
  const styles = useStyles(getStyles);

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
        {matchers.map(({ name, value, isRegex }: SilenceMatcher) => {
          return <AlertLabel key={`${name}-${value}`} labelKey={name} value={value} isRegex={isRegex} />;
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
