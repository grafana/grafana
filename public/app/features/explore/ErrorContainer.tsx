import React, { FC, useState, useContext } from 'react';
import { QueryFailure } from 'app/types';
import Panel from './Panel';
import { GrafanaTheme, ThemeContext, selectThemeVariant } from '@grafana/ui';
import { css, cx } from 'emotion';

interface Props {
  queryFailure: QueryFailure;
}

const getStyles = (theme: GrafanaTheme) => ({
  errorContainer: css`
    label: error-container;
    display: flex;
    flex-flow: column;
    white-space: pre-wrap;
  `,
  errorItem: css`
    label: error-item;
    margin-top: ${theme.spacing.xs};
    padding: ${theme.spacing.xs};
  `,
  errorText: css`
    label: error-text;
    color: ${selectThemeVariant({ light: theme.colors.redShade, dark: '#e84d4d' }, theme.type)};
  `,
});

export const ErrorContainer: FC<Props> = props => {
  const theme = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(true);
  const styles = getStyles(theme);
  const onToggle = () => {
    setIsOpen(!isOpen);
  };
  const { queryFailure } = props;

  if (!queryFailure) {
    return null;
  }

  return (
    <Panel label="Errors" isOpen={isOpen} onToggle={onToggle}>
      <div className={cx([styles.errorContainer])}>
        <div className={cx([styles.errorItem])}>
          <label>
            Error:&nbsp;
            <span className={cx([styles.errorText])}>{queryFailure.error}</span>
          </label>
        </div>
        <div className={cx([styles.errorItem])}>
          <label>
            Details:&nbsp;
            <span className={cx([styles.errorText])}>{queryFailure.errorDetails}</span>
          </label>
        </div>
      </div>
    </Panel>
  );
};
