import { StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Stack } from '@grafana/ui';

import { RadialBarEffects } from './panelcfg.gen';

/**
 * Editor for all the radial bar effects options
 */
export function EffectsEditor(props: StandardEditorProps<RadialBarEffects>) {
  return (
    <Stack direction="row" alignItems={'flex-start'} gap={1} wrap>
      <Checkbox
        label={t('radialbar.config.effects.rounded-bars', 'Rounded bars')}
        value={!!props.value?.rounded}
        onChange={(e) => props.onChange({ ...props.value, rounded: e.currentTarget.checked })}
      />
      <Checkbox
        label={t('radialbar.config.effects.bar-glow', 'Bar glow')}
        value={!!props.value?.barGlow}
        onChange={(e) => props.onChange({ ...props.value, barGlow: e.currentTarget.checked })}
      />
      <Checkbox
        label={t('radialbar.config.effects.center-glow', 'Center glow')}
        value={!!props.value?.centerGlow}
        onChange={(e) => props.onChange({ ...props.value, centerGlow: e.currentTarget.checked })}
      />
      <Checkbox
        label={t('radialbar.config.effects.spotlight', 'Spotlight')}
        value={!!props.value?.spotlight}
        onChange={(e) => props.onChange({ ...props.value, spotlight: e.currentTarget.checked })}
      />
    </Stack>
  );
}
