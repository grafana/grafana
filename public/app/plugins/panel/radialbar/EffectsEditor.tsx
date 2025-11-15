import { StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Switch, Label } from '@grafana/ui';

import { GaugePanelEffects } from './panelcfg.gen';

/**
 * Editor for all the radial bar effects options
 */
export function EffectsEditor(props: StandardEditorProps<GaugePanelEffects>) {
  return (
    <Stack direction="row" alignItems={'flex-start'} gap={1} wrap>
      <Stack>
        <Switch
          id="radialbar-rounded-bars"
          value={!!props.value?.rounded}
          onChange={(e) => props.onChange({ ...props.value, rounded: e.currentTarget.checked })}
        />
        <Label htmlFor="radialbar-rounded-bars">{t('radialbar.config.effects.rounded-bars', 'Rounded bars')}</Label>
      </Stack>
      <Stack>
        <Switch
          id="radialbar-bar-glow"
          label={t('radialbar.config.effects.bar-glow', 'Bar glow')}
          value={!!props.value?.barGlow}
          onChange={(e) => props.onChange({ ...props.value, barGlow: e.currentTarget.checked })}
        />
        <Label htmlFor="radialbar-bar-glow">{t('radialbar.config.effects.bar-glow', 'Bar glow')}</Label>
      </Stack>
      <Stack>
        <Switch
          id="radialbar-center-glow"
          label={t('radialbar.config.effects.center-glow', 'Center glow')}
          value={!!props.value?.centerGlow}
          onChange={(e) => props.onChange({ ...props.value, centerGlow: e.currentTarget.checked })}
        />
        <Label htmlFor="radialbar-center-glow">{t('radialbar.config.effects.center-glow', 'Center glow')}</Label>
      </Stack>
      <Stack>
        <Switch
          id="radialbar-spotlight"
          label={t('radialbar.config.effects.spotlight', 'Spotlight')}
          value={!!props.value?.spotlight}
          onChange={(e) => props.onChange({ ...props.value, spotlight: e.currentTarget.checked })}
        />
        <Label htmlFor="radialbar-spotlight">{t('radialbar.config.effects.spotlight', 'Spotlight')}</Label>
      </Stack>
    </Stack>
  );
}
