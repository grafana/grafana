import { GrafanaTheme, selectThemeVariant, ThemeContext } from '../../index';
import { css, cx } from 'emotion';
import React, { useRef, useContext, useMemo } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { List } from '../index';

export enum VariableOrigin {
  BuiltIn = 'builtin',
  Template = 'template',
}

export interface VariableSuggestion {
  value: string;
  documentation?: string;
  origin: VariableOrigin;
}

interface DataLinkSuggestionsProps {
  suggestions: VariableSuggestion[];
  activeIndex: number;
  onSuggestionSelect: (suggestion: VariableSuggestion) => void;
  onClose?: () => void;
}

const getStyles = (theme: GrafanaTheme) => {
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
    label: css`
      color: ${theme.colors.textWeak};
      font-size: ${theme.typography.size.sm};
      line-height: ${theme.typography.lineHeight.lg};
      padding: ${theme.spacing.sm};
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

export const DataLinkSuggestions: React.FC<DataLinkSuggestionsProps> = ({ suggestions, ...otherProps }) => {
  const ref = useRef(null);
  const theme = useContext(ThemeContext);
  useClickAway(ref, () => {
    if (otherProps.onClose) {
      otherProps.onClose();
    }
  });

  const templateSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => suggestion.origin === VariableOrigin.Template);
  }, [suggestions]);

  const builtInSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => suggestion.origin === VariableOrigin.BuiltIn);
  }, [suggestions]);

  const styles = getStyles(theme);
  return (
    <div ref={ref} className={styles.wrapper}>
      {templateSuggestions.length > 0 && (
        <DataLinkSuggestionsList
          {...otherProps}
          suggestions={templateSuggestions}
          label="Template variables"
          activeIndex={otherProps.activeIndex}
          activeIndexOffset={0}
        />
      )}
      {builtInSuggestions.length > 0 && (
        <DataLinkSuggestionsList
          {...otherProps}
          suggestions={builtInSuggestions}
          label="Built-in variables"
          activeIndexOffset={templateSuggestions.length}
        />
      )}
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
        <div className={styles.label}>{label}</div>
        <List
          items={suggestions}
          renderItem={(item, index) => {
            return (
              <div
                className={cx(styles.item, index + activeIndexOffset === activeIndex && styles.activeItem)}
                onClick={() => {
                  onSuggestionSelect(item);
                }}
              >
                <div className={styles.itemValue}>{item.value}</div>
                {item.documentation && <div className={styles.itemDocs}>{item.documentation}</div>}
              </div>
            );
          }}
        />
      </>
    );
  }
);

DataLinkSuggestionsList.displayName = 'DataLinkSuggestionsList';
