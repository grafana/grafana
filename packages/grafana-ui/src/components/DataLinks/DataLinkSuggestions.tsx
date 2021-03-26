import { ThemeContext } from '../../index';
import { GrafanaTheme, VariableSuggestion } from '@grafana/data';
import { css, cx } from 'emotion';
import _ from 'lodash';
import React, { useRef, useContext, useMemo } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { List } from '../index';
import { styleMixins, stylesFactory } from '../../themes';

interface DataLinkSuggestionsProps {
  suggestions: VariableSuggestion[];
  activeIndex: number;
  onSuggestionSelect: (suggestion: VariableSuggestion) => void;
  onClose?: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const wrapperBg = theme.colors.bg1;
  const wrapperShadow = theme.colors.dropdownShadow;
  const itemColor = theme.colors.text;
  const itemBgHover = styleMixins.hoverColor(theme.colors.bg1, theme);
  const itemBgActive = theme.colors.bg2;
  const separatorColor = theme.colors.border2;

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
      color: ${theme.colors.textWeak};
    `,
    activeItem: css`
      background: ${itemBgActive};
      &:hover {
        background: ${itemBgActive};
      }
    `,
    itemValue: css`
      font-family: ${theme.typography.fontFamily.monospace};
      font-size: ${theme.typography.size.sm};
    `,
  };
});

export const DataLinkSuggestions: React.FC<DataLinkSuggestionsProps> = ({ suggestions, ...otherProps }) => {
  const ref = useRef(null);
  const theme = useContext(ThemeContext);
  useClickAway(ref, () => {
    if (otherProps.onClose) {
      otherProps.onClose();
    }
  });

  const groupedSuggestions = useMemo(() => {
    return _.groupBy(suggestions, (s) => s.origin);
  }, [suggestions]);

  const styles = getStyles(theme);
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
            label={`${_.capitalize(key)}`}
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
    const theme = useContext(ThemeContext);
    const styles = getStyles(theme);

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
