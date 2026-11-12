import { useMemo } from 'react';
import { type StylesConfig } from 'react-select';

import { type GrafanaTheme2 } from '@grafana/data';

import { getQueryBuilderSelectRole } from './utils';

export default function resetSelectStyles(theme: GrafanaTheme2): Partial<StylesConfig> {
  return {
    clearIndicator: () => ({}),
    container: () => ({}),
    control: () => ({}),
    dropdownIndicator: () => ({}),
    group: () => ({}),
    groupHeading: () => ({}),
    indicatorsContainer: () => ({}),
    indicatorSeparator: () => ({}),
    input: function (originalStyles) {
      return {
        ...originalStyles,
        color: 'inherit',
        margin: 0,
        padding: 0,
        // Set an explicit z-index here to ensure this element always overlays the singleValue
        zIndex: 1,
        overflow: 'hidden',
      };
    },
    loadingIndicator: () => ({}),
    loadingMessage: () => ({}),
    menu: () => ({}),
    menuList: ({ maxHeight }) => ({
      maxHeight,
    }),
    multiValue: () => ({}),
    multiValueLabel: () => ({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    multiValueRemove: () => ({}),
    noOptionsMessage: () => ({}),
    option: () => ({}),
    placeholder: (originalStyles) => ({
      ...originalStyles,
      color: theme.colors.text.secondary,
    }),
    singleValue: () => ({}),
    valueContainer: () => ({}),
  };
}

export function useCustomSelectStyles(theme: GrafanaTheme2, width: number | string | undefined): Partial<StylesConfig> {
  return useMemo(() => {
    return {
      ...resetSelectStyles(theme),
      menuPortal: (base) => {
        // Would like to correct top position when menu is placed bottom, but have props are not sent to this style function.
        // Only state is. https://github.com/JedWatson/react-select/blob/master/packages/react-select/src/components/Menu.tsx#L605
        return {
          ...base,
          zIndex: theme.zIndex.portal,
        };
      },
      //These are required for the menu positioning to function
      menu: ({ top, bottom, position }) => {
        return {
          top,
          bottom,
          position,
          minWidth: '100%',
          zIndex: theme.zIndex.dropdown,
        };
      },
      container: (base, state) => {
        // The visual query builder (Loki, Prometheus, etc.) lays out its label filter
        // selects as direct flex children of a row owned by @grafana/plugin-ui (not
        // editable in this repo). Those rows squeeze their children, truncating the
        // key/operator text and starving the value column of space. Size the three
        // columns explicitly: the key/operator selects keep their content width and never
        // shrink, the value select absorbs the leftover row space (and wraps multi-value tags).
        // `selectProps` is typed as react-select's own `Props`, which omits the
        // `data-testid` we forward through `SelectCommonProps`. The `in` check narrows
        // it to a `Record<"data-testid", unknown>` without a type assertion (which the
        // repo's eslint config forbids).
        const testid =
          state?.selectProps && 'data-testid' in state.selectProps ? state.selectProps['data-testid'] : undefined;
        // Key off the select role (label / match operator / value), not isMulti: exact-match
        // value selects are single-value but must still absorb leftover row space.
        const queryBuilderRole = getQueryBuilderSelectRole(testid);
        return {
          ...base,
          width: width ? theme.spacing(width) : '100%',
          display: width === 'auto' ? 'inline-flex' : 'flex',
          // Cap auto/`100%` widths at the available row so oversized contents (e.g. many
          // multi-value tags) wrap inside the layout instead of widening it.
          minWidth: 0,
          maxWidth: '100%',
          // Lock the select to its content height and top-align it in its row. Without this,
          // packed rows (e.g. query builder label filters) default to `align-items: stretch`,
          // stretching the other select columns vertically as the value column grows.
          alignSelf: 'flex-start',
          height: 'fit-content',
          ...(queryBuilderRole === 'value'
            ? { flex: '1 1 0%', minWidth: '200px' }
            : queryBuilderRole
              ? { flex: '0 0 auto', minWidth: 'max-content' }
              : undefined),
        };
      },
      option: (provided, state) => ({
        ...provided,
        opacity: state.isDisabled ? 0.5 : 1,
      }),
    };
  }, [theme, width]);
}
