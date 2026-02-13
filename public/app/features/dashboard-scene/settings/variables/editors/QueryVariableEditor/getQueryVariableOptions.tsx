import { SceneVariable, QueryVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { PaneItem } from './PaneItem';

export function getQueryVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof QueryVariable)) {
    console.warn('getQueryVariableOptions: variable is not a QueryVariable');
    return [];
  }
  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <PaneItem variable={variable} />,
    }),
  ];
}
