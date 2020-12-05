import { GrafanaTheme } from '@grafana/data';
import { IconButton, stylesFactory, useTheme } from '@grafana/ui';
import { getInlineLabelStyles } from '@grafana/ui/src/components/Forms/InlineLabel';
import { css } from 'emotion';
import { noop } from 'lodash';
import React, { FunctionComponent } from 'react';

interface Props {
  label: string;
  onRemoveClick?: false | (() => void);
  onHideClick?: false | (() => void);
  hidden?: boolean;
}

export const QueryEditorRow: FunctionComponent<Props> = ({
  children,
  label,
  onRemoveClick,
  onHideClick,
  hidden = false,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <fieldset className={styles.root}>
      <div className={getInlineLabelStyles(theme, 17).label}>
        <legend className={styles.label}>{label}</legend>
        {onHideClick && (
          <IconButton
            name={hidden ? 'eye-slash' : 'eye'}
            onClick={onHideClick}
            surface="header"
            size="sm"
            aria-pressed={hidden}
            aria-label="hide metric"
            className={styles.icon}
          />
        )}
        <IconButton
          name="trash-alt"
          surface="header"
          size="sm"
          className={styles.icon}
          onClick={onRemoveClick || noop}
          disabled={!onRemoveClick}
          aria-label="remove metric"
        />
      </div>
      {children}
    </fieldset>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    root: css`
      display: flex;
      margin-bottom: ${theme.spacing.xs};
    `,
    label: css`
      font-size: ${theme.typography.size.sm};
      margin: 0;
    `,
    icon: css`
      color: ${theme.colors.textWeak};
      margin-left: ${theme.spacing.xxs};
    `,
  };
});
