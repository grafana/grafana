import { css, cx } from '@emotion/css';
import { groupBy, capitalize } from 'lodash';
import { useRef, useMemo } from 'react';
import * as React from 'react';
import useClickAway from 'react-use/lib/useClickAway';

import { VariableSuggestion, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { List } from '../List/List';

interface DataLinkSuggestionsProps {
  activeRef?: React.RefObject<HTMLDivElement>;
  suggestions: VariableSuggestion[];
  activeIndex: number;
  onSuggestionSelect: (suggestion: VariableSuggestion) => void;
  onClose?: () => void;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    list: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      '&:last-child': {
        border: 'none',
      },
    }),
    wrapper: css({
      background: theme.colors.background.primary,
      width: '250px',
    }),
    item: css({
      background: 'none',
      padding: '2px 8px',
      userSelect: 'none',
      color: theme.colors.text.primary,
      cursor: 'pointer',
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    label: css({
      color: theme.colors.text.secondary,
    }),
    activeItem: css({
      background: theme.colors.background.secondary,
      '&:hover': {
        background: theme.colors.background.secondary,
      },
    }),
    itemValue: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.size.sm,
    }),
  };
};

export const DataLinkSuggestions = ({ suggestions, ...otherProps }: DataLinkSuggestionsProps) => {
  const ref = useRef(null);

  useClickAway(ref, () => {
    if (otherProps.onClose) {
      otherProps.onClose();
    }
  });

  const groupedSuggestions = useMemo(() => {
    return groupBy(suggestions, (s) => s.origin);
  }, [suggestions]);

  const styles = useStyles2(getStyles);

  return (
    <div role="menu" ref={ref} className={styles.wrapper}>
      {Object.keys(groupedSuggestions).map((key, i) => {
        const indexOffset =
          i === 0
            ? 0
            : Object.keys(groupedSuggestions).reduce((acc, current, index) => {
                if (index >= i) {
                  return acc;
                }
                return acc + groupedSuggestions[current].length;
              }, 0);

        return (
          <DataLinkSuggestionsList
            {...otherProps}
            suggestions={groupedSuggestions[key]}
            label={`${capitalize(key)}`}
            activeIndex={otherProps.activeIndex}
            activeIndexOffset={indexOffset}
            key={key}
          />
        );
      })}
    </div>
  );
};

DataLinkSuggestions.displayName = 'DataLinkSuggestions';

interface DataLinkSuggestionsListProps extends DataLinkSuggestionsProps {
  label: string;
  activeIndexOffset: number;
  activeRef?: React.RefObject<HTMLDivElement>;
}

const DataLinkSuggestionsList = React.memo(
  ({
    activeIndex,
    activeIndexOffset,
    label,
    onClose,
    onSuggestionSelect,
    suggestions,
    activeRef: selectedRef,
  }: DataLinkSuggestionsListProps) => {
    const styles = useStyles2(getStyles);

    return (
      <>
        <List
          className={styles.list}
          items={suggestions}
          renderItem={(item, index) => {
            const isActive = index + activeIndexOffset === activeIndex;
            return (
              // key events are handled by DataLinkInput
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <div
                role="menuitem"
                tabIndex={0}
                className={cx(styles.item, isActive && styles.activeItem)}
                ref={isActive ? selectedRef : undefined}
                onClick={() => {
                  onSuggestionSelect(item);
                }}
                title={item.documentation}
              >
                <span className={styles.itemValue}>
                  <span className={styles.label}>{label}</span> {item.label}
                </span>
              </div>
            );
          }}
        />
      </>
    );
  }
);

DataLinkSuggestionsList.displayName = 'DataLinkSuggestionsList';
