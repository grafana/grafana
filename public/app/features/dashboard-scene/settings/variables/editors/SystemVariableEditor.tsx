import { SceneVariable, LocalValueVariable } from '@grafana/scenes';
import { Stack } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

export function getSystemVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof LocalValueVariable)) {
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      title: '',
      render: () => {
        return (
          <Stack direction="column">
            <Stack>
              <Stack>
                <span>${variable.state.name}</span>
                <span>=</span>
                <span>${variable.getValueText()}</span>
              </Stack>
            </Stack>
          </Stack>
        );
      },
    }),
  ];
}
