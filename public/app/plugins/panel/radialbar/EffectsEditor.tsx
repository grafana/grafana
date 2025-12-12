import { css } from '@emotion/css';
import { ComponentProps, useId } from 'react';

import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Switch, Label, Tooltip, Grid, useStyles2 } from '@grafana/ui';

import { GaugePanelEffects } from './panelcfg.gen';

function EffectsEditorInput(props: ComponentProps<typeof Switch> & { tooltip?: string }) {
  const id = useId();
  const styles = useStyles2(getStyles);
  const content = (
    <div className={styles.container}>
      <Stack gap={1} alignItems="center">
        <Switch {...props} id={id} />
        <Label className={styles.label} htmlFor={id}>
          {props.label}
        </Label>
      </Stack>
    </div>
  );
  if (props.tooltip) {
    return <Tooltip content={props.tooltip}>{content}</Tooltip>;
  }
  return content;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    label: css({ marginBottom: 0 }),
    container: css({ paddingBlock: theme.spacing(0.5) }),
  };
}

/**
 * Editor for all the radial bar effects options
 */
export function EffectsEditor(props: StandardEditorProps<GaugePanelEffects>) {
  return (
    <Grid alignItems={'flex-start'} gap={1} minColumnWidth={16}>
      <EffectsEditorInput
        label={t('radialbar.config.effects.gradient', 'Gradient')}
        value={!!props.value?.gradient}
        onChange={(e) => props.onChange({ ...props.value, gradient: e.currentTarget.checked })}
      />
      <EffectsEditorInput
        label={t('radialbar.config.effects.bar-glow', 'Bar glow')}
        value={!!props.value?.barGlow}
        onChange={(e) => props.onChange({ ...props.value, barGlow: e.currentTarget.checked })}
      />
      <EffectsEditorInput
        label={t('radialbar.config.effects.center-glow', 'Center glow')}
        value={!!props.value?.centerGlow}
        onChange={(e) => props.onChange({ ...props.value, centerGlow: e.currentTarget.checked })}
      />
    </Grid>
  );
}
