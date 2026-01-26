import { useId, useMemo } from 'react';

import { VariableRefresh } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { QueryVariable } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';

export function useVariableRefreshCategory(variable: QueryVariable): OptionsPaneCategoryDescriptor {
  const refreshId = useId();

  return useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.use-variable-refreshs-category.title.refresh-options', 'Refresh options'),
      id: 'refresh-options-category',
      isOpenDefault: true,
    }).addItem(
      new OptionsPaneItemDescriptor({
        id: refreshId,
        // TODO: use title and description here and not in <QueryVariableRefreshSelect />
        render: (descriptor) => {
          const { refresh } = variable.useState();
          const onRefreshChange = (refresh: VariableRefresh) => {
            variable.setState({ refresh: refresh });
          };
          return (
            <div id={descriptor.props.id}>
              <QueryVariableRefreshSelect
                testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2}
                onChange={onRefreshChange}
                refresh={refresh}
              />
            </div>
          );
        },
      })
    );
  }, [refreshId, variable]);
}
