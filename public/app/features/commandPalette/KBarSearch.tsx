import { css } from '@emotion/css';
import { useKBar, VisualState } from 'kbar';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const KBAR_LISTBOX = 'kbar-listbox';
export const getListboxItemId = (id: number) => `kbar-listbox-item-${id}`;

export function KBarSearch(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    defaultPlaceholder?: string;
  }
) {
  const { query, search, actions, currentRootActionId, activeIndex, showing, options } = useKBar((state) => ({
    search: state.searchQuery,
    currentRootActionId: state.currentRootActionId,
    actions: state.actions,
    activeIndex: state.activeIndex,
    showing: state.visualState === VisualState.showing,
  }));

  const [inputValue, setInputValue] = React.useState(search);
  React.useEffect(() => {
    query.setSearch(inputValue);
  }, [inputValue, query]);

  const { defaultPlaceholder, ...rest } = props;

  React.useEffect(() => {
    query.setSearch('');
    query.getInput().focus();
    setInputValue('');
    return () => query.setSearch('');
  }, [currentRootActionId, query]);

  const defaultText = defaultPlaceholder ?? 'Type a command or search…';

  const styles = useStyles2(getStyles);

  return (
    <input
      {...rest}
      className={styles.input}
      ref={query.inputRefSetter}
      /* eslint-disable-next-line jsx-a11y/no-autofocus */
      autoFocus
      autoComplete="off"
      role="combobox"
      spellCheck="false"
      aria-expanded={showing}
      aria-controls={KBAR_LISTBOX}
      aria-activedescendant={getListboxItemId(activeIndex)}
      value={inputValue}
      placeholder={defaultText}
      onChange={(event) => {
        props.onChange?.(event);
        setInputValue(event.target.value);
        options?.callbacks?.onQueryChange?.(event.target.value);
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (currentRootActionId && !search && event.key === 'Backspace') {
          const parent = actions[currentRootActionId].parent;
          query.setCurrentRootAction(parent);
        }
      }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    input: css({
      label: 'kbar-search-input',
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: theme.typography.body.lineHeight,
      color: theme.colors.text.secondary,
      width: '100%',
      outline: 'none',
      paddingLeft: 0,
    }),
  };
};
