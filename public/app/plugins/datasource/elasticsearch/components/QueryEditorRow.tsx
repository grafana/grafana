import { IconButton, useTheme } from '@grafana/ui';
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

  return (
    <fieldset
      className={css`
        display: block;
        margin-bottom: ${theme.spacing.xs};
      `}
    >
      <div className={cx(flex)}>
        <div className={cx(getInlineLabelStyles(theme, 15).label)}>
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
                aria-pressed={hidden}
                aria-label="hide metric"
              />
            )}
            <IconButton
              name="trash-alt"
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
