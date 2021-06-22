import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, InlineFieldRow, InlineLabel, InlineSegmentGroup, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { noop } from 'lodash';
import React, { PropsWithChildren } from 'react';

interface Props {
  label: string;
  onRemoveClick?: false | (() => void);
  onHideClick?: false | (() => void);
  hidden?: boolean;
}

export const QueryEditorRow = ({
  children,
  label,
  onRemoveClick,
  onHideClick,
  hidden = false,
}: PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);

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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    iconWrapper: css`
      display: flex;
    `,
    icon: css`
      color: ${theme.colors.text.secondary};
      margin-left: ${theme.spacing(0.25)};
    `,
  };
};
