import { css, cx } from '@emotion/css';
import { useKBar, VisualState } from 'kbar';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { getInputStyles, Icon, Text, ToolbarButton, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { getModKey } from 'app/core/utils/browser';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

export const TopSearchBarCommandPaletteTrigger = React.memo(() => {
  const { query: kbar } = useKBar((kbarState) => ({
    kbarSearchQuery: kbarState.searchQuery,
    kbarIsOpen: kbarState.visualState === VisualState.showing,
  }));

  const isLargeScreen = useMediaQueryMinWidth('lg');

  const onOpenSearch = () => {
    kbar.toggle();
  };

  if (!isLargeScreen) {
    return (
      <>
        <ToolbarButton
          iconOnly
          icon="search"
          aria-label={t('nav.search.placeholderCommandPalette', 'Search...')}
          onClick={onOpenSearch}
        />
        <NavToolbarSeparator />
      </>
    );
  }

  return <PretendTextInput onClick={onOpenSearch} />;
});
TopSearchBarCommandPaletteTrigger.displayName = 'TopSearchBarCommandPaletteTrigger';

interface PretendTextInputProps {
  onClick: () => void;
}

function PretendTextInput({ onClick }: PretendTextInputProps) {
  const styles = useStyles2(getStyles);
  const modKey = useMemo(() => getModKey(), []);

  // We want the desktop command palette trigger to look like a search box,
  // but it actually behaves like a button - you active it and it performs an
  // action. You don't actually type into it.

  return (
    <div className={styles.wrapper} data-testid={selectors.components.NavToolbar.commandPaletteTrigger}>
      <div className={styles.inputWrapper}>
        <div className={styles.prefix}>
          <Icon name="search" />
        </div>

        <button className={styles.fakeInput} onClick={onClick}>
          {t('nav.search.placeholderCommandPalette', 'Search...')}
        </button>

        <div className={styles.suffix}>
          <Text variant="bodySmall">{`${modKey}+k`}</Text>
        </div>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const baseStyles = getInputStyles({ theme });

  return {
    wrapper: cx(
      baseStyles.wrapper,
      css({
        width: 'auto',
        minWidth: 140,
        maxWidth: 350,
        flexGrow: 1,
      })
    ),
    inputWrapper: baseStyles.inputWrapper,
    prefix: baseStyles.prefix,
    suffix: css([
      baseStyles.suffix,
      {
        display: 'flex',
        gap: theme.spacing(0.5),
      },
    ]),
    fakeInput: css([
      baseStyles.input,
      {
        textAlign: 'left',
        paddingLeft: 28,
        color: theme.colors.text.disabled,

        // We want the focus styles to appear only when tabbing through, not when clicking the button
        // (and when focus is restored after command palette closes)
        '&:focus': {
          outline: 'unset',
          boxShadow: 'unset',
        },

        '&:focus-visible': getFocusStyles(theme),
      },
    ]),

    button: css({
      // height: 32,
      width: '100%',
      textAlign: 'center',

      '> *': {
        width: '100%',
        textAlign: 'center',
        justifyContent: 'center',
        gap: '1ch',
      },
    }),
  };
};
