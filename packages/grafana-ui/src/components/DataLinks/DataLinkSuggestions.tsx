import { VariableSuggestion, GrafanaThemeV2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { groupBy, capitalize } from 'lodash';
import React, { useRef, useMemo } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { List } from '../index';
import { useStyles2 } from '../../themes';

interface DataLinkSuggestionsProps {
  suggestions: VariableSuggestion[];
  activeIndex: number;
  onSuggestionSelect: (suggestion: VariableSuggestion) => void;
  onClose?: () => void;
}

const getStyles = (theme: GrafanaThemeV2) => {
  const wrapperBg = theme.colors.background.primary;
  const wrapperShadow = theme.shadows.z1;
  const itemColor = theme.colors.text.primary;
  const itemBgHover = theme.colors.emphasize(theme.colors.background.primary, 0.05);
  const itemBgActive = theme.colors.background.secondary;
  const separatorColor = theme.colors.border.weak;

  return {
    list: css`
      border-bottom: 1px solid ${separatorColor};
      &:last-child {
        border: none;
      }
    `,
    wrapper: css`
      background: ${wrapperBg};
      z-index: 1;
      width: 250px;
      box-shadow: 0 5px 10px 0 ${wrapperShadow};
    `,
    item: css`
      background: none;
      padding: 2px 8px;
      color: ${itemColor};
      cursor: pointer;
      &:hover {
        background: ${itemBgHover};
      }
    `,
    label: css`
      color: ${theme.colors.text.secondary};
    `,
    activeItem: css`
      background: ${itemBgActive};
      &:hover {
        background: ${itemBgActive};
      }
    `,
    itemValue: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.size.sm};
    `,
  };
};

export const DataLinkSuggestions: React.FC<DataLinkSuggestionsProps> = ({ suggestions, ...otherProps }) => {
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
    <div ref={ref} className={styles.wrapper}>
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
}

const DataLinkSuggestionsList: React.FC<DataLinkSuggestionsListProps> = React.memo(
  ({ activeIndex, activeIndexOffset, label, onClose, onSuggestionSelect, suggestions }) => {
    const styles = useStyles2(getStyles);

    return (
      <>
        <List
          className={styles.list}
          items={suggestions}
          renderItem={(item, index) => {
            return (
              <div
                className={cx(styles.item, index + activeIndexOffset === activeIndex && styles.activeItem)}
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
