import { CSSObjectWithLabel } from 'react-select';

export default function resetSelectStyles() {
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
    placeholder: () => ({}),
    singleValue: () => ({
      // Set an explicit z-index here to ensure this element always sits under the input
      zIndex: -1,
    }),
    valueContainer: () => ({}),
  };
}
