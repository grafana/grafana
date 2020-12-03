import { GrafanaTheme } from '@grafana/data';
import { IconButton, stylesFactory, useTheme } from '@grafana/ui';
import { getInlineLabelStyles } from '@grafana/ui/src/components/Forms/InlineLabel';
import { css, cx } from 'emotion';
import { noop } from 'lodash';
import React, { FunctionComponent } from 'react';

const flex = css`
  label: QueryEditorRow;
  display: flex;
  align-items: start;
  flex-direction: row;
`;

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
    <fieldset
      className={css`
        display: block;
        margin-bottom: ${theme.spacing.xs};
      `}
    >
      <div className={cx(flex)}>
        <div className={cx(getInlineLabelStyles(theme, 17).label)}>
          <legend
            className={css`
              font-size: ${theme.typography.size.sm};
              margin: 0;
            `}
          >
            {label}
          </legend>
          <div
            className={css`
              display: flex;
              flex-direction: row;
              align-items: center;
            `}
          >
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
        </div>
        {children}
      </div>
    </fieldset>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.colors.textWeak};
      margin-left: ${theme.spacing.xxs};
    `,
  };
});
