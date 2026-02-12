import { useMemo } from 'react';

import { RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Alert, Combobox, ComboboxOption } from '@grafana/ui';

import { CustomComboBoxProps } from '../../../common/ComboBox.types';
import { USER_DEFINED_TREE_NAME } from '../../consts';
import { useListRoutingTrees } from '../../hooks/useRoutingTrees';

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
  const {
    currentData: routingTrees,
    isLoading,
    isError,
  } = useListRoutingTrees({}, { refetchOnFocus: true, refetchOnMountOrArgChange: true });

  // Build a lookup map from option value → RoutingTree for resolving onChange
  const { options, treeLookup } = useMemo(() => {
    if (!routingTrees?.items) {
      const empty: { options: Array<ComboboxOption<string>>; treeLookup: Map<string, RoutingTree> } = {
        options: [],
        treeLookup: new Map(),
      };
      return empty;
    }

    const lookup = new Map<string, RoutingTree>();
    const opts: Array<ComboboxOption<string>> = routingTrees.items
      .map((tree) => {
        const name = tree.metadata.name ?? '';
        const isDefault = name === USER_DEFINED_TREE_NAME;

        lookup.set(name, tree);

        return {
          label: isDefault ? t('alerting.routing-tree-selector.default-policy', 'Default policy') : name,
          value: name,
          description: isDefault
            ? t(
                'alerting.routing-tree-selector.default-policy-desc',
                'Routes alerts using the default notification policy tree'
              )
            : t('alerting.routing-tree-selector.custom-policy-desc', 'Route alerts through the {{name}} policy tree', {
                name,
              }),
        } satisfies ComboboxOption<string>;
      })
      .sort((a, b) => {
        // Default policy always first
        if (a.value === USER_DEFINED_TREE_NAME) {
          return -1;
        }
        if (b.value === USER_DEFINED_TREE_NAME) {
          return 1;
        }
        return collator.compare(a.label, b.label);
      });

    return { options: opts, treeLookup: lookup };
  }, [routingTrees?.items]);

  const handleChange = (selectedOption: ComboboxOption<string> | null) => {
    if (selectedOption == null && props.isClearable) {
      props.onChange(null);
      return;
    }

    if (selectedOption) {
      const tree = treeLookup.get(selectedOption.value);
      if (!tree) {
        console.warn(`RoutingTreeSelector: could not find routing tree for value "${selectedOption.value}"`);
        return;
      }

      props.onChange(tree);
    }
  };

  if (isError) {
    return (
      <Alert
        severity="warning"
        title={t('alerting.routing-tree-selector.error', 'Failed to load notification policies')}
      />
    );
  }

  return <Combobox {...props} loading={isLoading} options={options} onChange={handleChange} />;
}

export { RoutingTreeSelector };
