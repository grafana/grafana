import { GrafanaTheme, selectThemeVariant, ThemeContext } from '../../index';
import { css, cx } from 'emotion';
import React, { useRef, useContext } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { List } from '../index';

export interface VariableSuggestion {
  value: string;
  documentation: string;
}

interface DataLinkSuggestionsProps {
  suggestions: VariableSuggestion[];
  activeIndex: number;
  onSuggestionSelect: (suggestion: VariableSuggestion) => void;
  onClose?: () => void;
}

const DataLinkSuggestionsStyles = (theme: GrafanaTheme) => {
  const wrapperBg = selectThemeVariant(
    {
      light: theme.colors.white,
      dark: theme.colors.dark2,
    },
    theme.type
  );

  const wrapperShadow = selectThemeVariant(
    {
      light: theme.colors.gray5,
      dark: theme.colors.black,
    },
    theme.type
  );

  const itemColor = selectThemeVariant(
    {
      light: theme.colors.black,
      dark: theme.colors.white,
    },
    theme.type
  );

  const itemDocsColor = selectThemeVariant(
    {
      light: theme.colors.dark3,
      dark: theme.colors.gray2,
    },
    theme.type
  );

  const itemBgHover = selectThemeVariant(
    {
      light: theme.colors.gray5,
      dark: theme.colors.dark7,
    },
    theme.type
  );

  const itemBgActive = selectThemeVariant(
    {
      light: theme.colors.gray6,
      dark: theme.colors.dark9,
    },
    theme.type
  );

  return {
    wrapper: css`
      background: ${wrapperBg};
      z-index: 1;
      width: 200px;
      box-shadow: 0 5px 10px 0 ${wrapperShadow};
    `,
    item: css`
      background: none;
      padding: 4px 8px;
      color: ${itemColor};
      cursor: pointer;
      &:hover {
        background: ${itemBgHover};
      }
    `,
    activeItem: css`
      background: ${itemBgActive};
      &:hover {
        background: ${itemBgActive};
      }
    `,
    itemValue: css`
      font-family: ${theme.typography.fontFamily.monospace};
    `,
    itemDocs: css`
      margin-top: ${theme.spacing.xs};
      color: ${itemDocsColor};
      font-size: ${theme.typography.size.sm};
    `,
  };
};

export const DataLinkSuggestions: React.FC<DataLinkSuggestionsProps> = ({
  suggestions,
  onSuggestionSelect,
  onClose,
  activeIndex,
}) => {
  const ref = useRef(null);
  const theme = useContext(ThemeContext);
  useClickAway(ref, () => {
    if (onClose) {
      onClose();
    }
  });

  const styles = DataLinkSuggestionsStyles(theme);

  return (
    <div ref={ref} className={styles.wrapper}>
      <List
        items={suggestions}
        renderItem={(item, index) => {
          return (
            <div
              className={cx(styles.item, index === activeIndex && styles.activeItem)}
              onClick={() => {
                onSuggestionSelect(item);
              }}
            >
              <div className={styles.itemValue}>{item.value}</div>
              <div className={styles.itemDocs}>{item.documentation}</div>
            </div>
          );
        }}
      />
    </div>
  );
};
