import { type ComponentProps } from 'react';

import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { t } from '@grafana/i18n';
import { Alert, Combobox, type ComboboxOption, MultiCombobox } from '@grafana/ui';

import { type CustomComboBoxProps } from '../../../common/ComboBox.types';
import { useRoutingTreeOptions } from '../../hooks/useRoutingTreeOptions';
import { findRoutingTreeByName } from '../../routingTrees';

type SingleSelectProps = CustomComboBoxProps<RoutingTree> & { multi?: false };
type MultiSelectProps = Omit<ComponentProps<typeof MultiCombobox<string>>, 'options' | 'loading' | 'onChange'> & {
  multi: true;
  onChange: (trees: RoutingTree[]) => void;
};

export type RoutingTreeSelectorProps = SingleSelectProps | MultiSelectProps;

/**
 * Routing Tree Combobox which lists all available notification policy trees.
 *
 * The default routing tree (named "user-defined") is displayed as "Default policy"
 * and is always listed first.
 *
 * Supports both single-select (default) and multi-select modes via the `multi` prop.
 *
 * @example
 * ```tsx
 * // Single select
 * <RoutingTreeSelector
 *   value={selectedTreeName}
 *   onChange={(tree) => setSelectedTree(tree)}
 * />
 *
 * // Multi select
 * <RoutingTreeSelector
 *   multi
 *   value={selectedTreeNames}
 *   onChange={(trees) => setSelectedTrees(trees)}
 * />
 * ```
 */
function RoutingTreeSelector(props: RoutingTreeSelectorProps) {
  const { options, trees, isLoading, isError } = useRoutingTreeOptions();

  if (isError) {
    return (
      <Alert
        severity="warning"
        title={t('alerting.routing-tree-selector.error', 'Failed to load notification policies')}
      />
    );
  }

  if (props.multi) {
    const { multi: _, onChange, ...rest } = props;

    const handleChange = (selectedOptions: Array<ComboboxOption<string>>) => {
      const selectedTrees = selectedOptions
        .map((opt) => findRoutingTreeByName(trees, opt.value))
        .filter((tree): tree is RoutingTree => tree != null);
      onChange(selectedTrees);
    };

    // @ts-expect-error TypeScript cannot narrow rest-spread from discriminated unions with conditional width types
    return <MultiCombobox {...rest} loading={isLoading} options={options} onChange={handleChange} />;
  }

  const handleChange = (selectedOption: ComboboxOption<string> | null) => {
    if (selectedOption == null && props.isClearable) {
      props.onChange(null);
      return;
    }

    if (selectedOption) {
      const tree = findRoutingTreeByName(trees, selectedOption.value);
      if (!tree) {
        console.warn(`RoutingTreeSelector: could not find routing tree for value "${selectedOption.value}"`);
        return;
      }

      props.onChange(tree);
    }
  };

  // The combobox picks the selected option by matching value strings exactly, and our option
  // values are the tree's real name (like "user-defined"). But some callers pass "" instead to
  // mean "the default tree", so look the name up to get whatever the real one is. Don't touch
  // undefined/null though - those mean "nothing picked yet", not "default".
  const resolvedValue =
    typeof props.value === 'string'
      ? (findRoutingTreeByName(trees, props.value)?.metadata.name ?? props.value)
      : props.value;

  return <Combobox {...props} value={resolvedValue} loading={isLoading} options={options} onChange={handleChange} />;
}

export { RoutingTreeSelector };
