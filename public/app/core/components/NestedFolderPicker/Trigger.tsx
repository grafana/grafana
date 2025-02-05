import { css, cx } from '@emotion/css';
import { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, getInputStyles, useTheme2, Text } from '@grafana/ui';
import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/src/themes/mixins';
import { Trans, t } from 'app/core/internationalization';

import { FolderPickerSkeleton } from './Skeleton';

interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  handleClearSelection?: (event: React.MouseEvent<SVGElement> | React.KeyboardEvent<SVGElement>) => void;
  invalid?: boolean;
  label?: ReactNode;
}

function Trigger(
  { handleClearSelection, isLoading, invalid, label, ...rest }: TriggerProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  const theme = useTheme2();
  const styles = getStyles(theme, invalid);

  const handleKeyDown = (event: React.KeyboardEvent<SVGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleClearSelection?.(event);
    }
  };

  if (isLoading) {
    return <FolderPickerSkeleton />;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        {label ? (
          <div className={styles.prefix}>
            <Icon name="folder" />
          </div>
        ) : undefined}

        <button
          type="button"
          className={cx(styles.fakeInput, label ? styles.hasPrefix : undefined)}
          {...rest}
          ref={ref}
        >
          {label ? (
            <Text truncate>{label}</Text>
          ) : (
            <Text truncate color="secondary">
              <Trans i18nKey="browse-dashboards.folder-picker.button-label">Select folder</Trans>
            </Text>
          )}

          {!isLoading && handleClearSelection && (
            <Icon
              role="button"
              tabIndex={0}
              aria-label={t('browse-dashboards.folder-picker.clear-selection', 'Clear selection')}
              className={styles.clearIcon}
              name="times"
              onClick={handleClearSelection}
              onKeyDown={handleKeyDown}
            />
          )}
        </button>

        <div className={styles.suffix}>
          <Icon name="angle-down" />
        </div>
      </div>
    </div>
  );
}

export default forwardRef(Trigger);

const getStyles = (theme: GrafanaTheme2, invalid = false) => {
  const baseStyles = getInputStyles({ theme, invalid });

  return {
    wrapper: baseStyles.wrapper,
    inputWrapper: baseStyles.inputWrapper,

    prefix: css([
      baseStyles.prefix,
      {
        pointerEvents: 'none',
        color: theme.colors.text.primary,
      },
    ]),

    suffix: css([
      baseStyles.suffix,
      {
        pointerEvents: 'none',
      },
    ]),

    fakeInput: css([
      baseStyles.input,
      {
        textAlign: 'left',

        letterSpacing: 'normal',

        // We want the focus styles to appear only when tabbing through, not when clicking the button
        // (and when focus is restored after command palette closes)
        '&:focus': {
          outline: 'unset',
          boxShadow: 'unset',
        },

        '&:focus-visible': getFocusStyles(theme),
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
        paddingRight: 28,
      },
    ]),

    hasPrefix: css({
      paddingLeft: 28,
    }),

    clearIcon: css({
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
      '&:focus-visible': getFocusStyles(theme),
    }),
  };
};
