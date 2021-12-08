import { GrafanaTheme2 } from '@grafana/data';
import { CSSObjectWithLabel } from 'react-select';

export default function resetSelectStyles(theme: GrafanaTheme2) {
  return {
    clearIndicator: () => ({}),
    container: () => ({}),
    control: () => ({}),
    dropdownIndicator: () => ({}),
    group: () => ({}),
    groupHeading: () => ({}),
    indicatorsContainer: () => ({}),
    indicatorSeparator: () => ({}),
    input: function (originalStyles: CSSObjectWithLabel) {
      return {
        ...originalStyles,
        color: 'inherit',
        margin: 0,
        padding: 0,
        // Set an explicit z-index here to ensure this element always overlays the singleValue
        zIndex: 1,
      };
    },
    loadingIndicator: () => ({}),
    loadingMessage: () => ({}),
    menu: () => ({}),
    menuList: ({ maxHeight }: { maxHeight: number }) => ({
      maxHeight,
    }),
    multiValue: () => ({}),
    multiValueLabel: () => ({}),
    multiValueRemove: () => ({}),
    noOptionsMessage: () => ({}),
    option: () => ({}),
    placeholder: (originalStyles: CSSObjectWithLabel) => ({
      ...originalStyles,
      color: theme.colors.text.disabled,
    }),
    singleValue: () => ({}),
    valueContainer: () => ({}),
  };
}
