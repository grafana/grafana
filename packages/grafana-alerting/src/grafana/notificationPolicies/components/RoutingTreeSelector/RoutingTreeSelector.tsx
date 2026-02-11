import { useMemo } from 'react';

import { RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { USER_DEFINED_TREE_NAME } from '../../consts';
import { useListRoutingTrees } from '../../hooks/useRoutingTrees';

import { CustomComboBoxProps } from './ComboBox.types';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

export type RoutingTreeSelectorProps = CustomComboBoxProps<RoutingTree>;

/**
 * Routing Tree Combobox which lists all available notification policy trees.
 *
 * When the `alertingMultiplePolicies` feature toggle is enabled on the backend,
 * this shows all available routing trees. Otherwise, it shows only the default
 * "user-defined" tree.
 *
 * The default routing tree (named "user-defined") is displayed as "Default policy"
 * and is always listed first.
 *
 * @example
 * ```tsx
 * <RoutingTreeSelector
 *   value={selectedTreeName}
 *   onChange={(tree) => setSelectedTree(tree)}
 * />
 * ```
 */
function RoutingTreeSelector(props: RoutingTreeSelectorProps) {
  const { ...comboboxProps } = props;

  const { currentData: routingTrees, isLoading } = useListRoutingTrees(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );

  // Create a mapping of options with their corresponding routing trees
  const routingTreeOptions = useMemo(() => {
    if (!routingTrees?.items) {
      return [];
    }

    return routingTrees.items
      .map((tree) => {
        const isDefault = tree.metadata.name === USER_DEFINED_TREE_NAME;

        return {
          option: {
            label: isDefault
              ? t('alerting.routing-tree-selector.default-policy', 'Default policy')
              : (tree.metadata.name ?? ''),
            value: tree.metadata.name ?? '',
            description: isDefault
              ? t(
                  'alerting.routing-tree-selector.default-policy-desc',
                  'Routes alerts using the default notification policy tree'
                )
              : t(
                  'alerting.routing-tree-selector.custom-policy-desc',
                  'Route alerts through the {{name}} policy tree',
                  { name: tree.metadata.name }
                ),
          } satisfies ComboboxOption<string>,
          tree,
        };
      })
      .sort((a, b) => {
        // Default policy always first
        if (a.tree.metadata.name === USER_DEFINED_TREE_NAME) {
          return -1;
        }
        if (b.tree.metadata.name === USER_DEFINED_TREE_NAME) {
          return 1;
        }
        return collator.compare(a.option.label, b.option.label);
      });
  }, [routingTrees?.items]);

  const options = routingTreeOptions.map<ComboboxOption>((item) => item.option);

  const handleChange = (selectedOption: ComboboxOption<string> | null) => {
    if (selectedOption == null && comboboxProps.isClearable) {
      comboboxProps.onChange(null);
      return;
    }

    if (selectedOption) {
      const matchedOption = routingTreeOptions.find(({ option }) => option.value === selectedOption.value);
      if (!matchedOption) {
        return;
      }

      comboboxProps.onChange(matchedOption.tree);
    }
  };

  return <Combobox {...comboboxProps} loading={isLoading} options={options} onChange={handleChange} />;
}

export { RoutingTreeSelector };
