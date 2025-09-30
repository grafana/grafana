import { StandardEditorProps } from '@grafana/data';
import { Checkbox, Stack } from '@grafana/ui';

import { RadialBarEffects } from './panelcfg.gen';

/**
 * Editor for all the radial bar effects options
 */
export function EffectsEditor(props: StandardEditorProps<RadialBarEffects>) {
  return (
    <Stack direction="row" alignItems={'flex-start'} gap={2} wrap>
      <Checkbox
        label="Rounded"
        value={!!props.value?.rounded}
        onChange={(e) => props.onChange({ ...props.value, rounded: e.currentTarget.checked })}
      />
      <Checkbox
        label="Bar glow"
        value={!!props.value?.barGlow}
        onChange={(e) => props.onChange({ ...props.value, barGlow: e.currentTarget.checked })}
      />
      <Checkbox
        label="Center glow"
        value={!!props.value?.centerGlow}
        onChange={(e) => props.onChange({ ...props.value, centerGlow: e.currentTarget.checked })}
      />
      <Checkbox
        label="Spotlight"
        value={!!props.value?.spotlight}
        onChange={(e) => props.onChange({ ...props.value, spotlight: e.currentTarget.checked })}
      />
    </Stack>
  );
}
