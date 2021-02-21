import { GrafanaTheme } from '@grafana/data';
import { IconButton, InlineFieldRow, InlineLabel, InlineSegmentGroup, stylesFactory, useTheme } from '@grafana/ui';
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
    <InlineFieldRow>
      <InlineSegmentGroup>
        <InlineLabel width={17} as="div">
          <span>{label}</span>
          <span className={styles.iconWrapper}>
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
          </span>
        </InlineLabel>
      </InlineSegmentGroup>
      {children}
    </InlineFieldRow>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    iconWrapper: css`
      display: flex;
    `,
    icon: css`
      color: ${theme.colors.textWeak};
      margin-left: ${theme.spacing.xxs};
    `,
  };
});
