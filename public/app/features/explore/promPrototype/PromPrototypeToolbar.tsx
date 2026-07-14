// Prototype-only. Not internationalized.
// Segmented control for A/B/C, injected into ExploreToolbar's leftItems when
// the current pane's datasource is Prometheus.

import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';

import { usePromPrototype, type PromPrototypeOption } from './PromPrototypeContext';

const OPTIONS: Array<{ label: string; value: PromPrototypeOption; description: string }> = [
  { label: 'A · Rail', value: 'a', description: 'Anchored left-hand panel' },
  { label: 'B · Popover', value: 'b', description: 'Popover-triggered, pinnable' },
  { label: 'C · Assistant', value: 'c', description: 'Type "/ " in the editor to open Grafana Assistant' },
];

export function PromPrototypeToolbar() {
  const { option, setOption } = usePromPrototype();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrap} data-testid="prom-prototype-toolbar">
      <span className={styles.label}>Prototype</span>
      <RadioButtonGroup
        size="sm"
        value={option}
        options={OPTIONS.map((o) => ({ label: o.label, value: o.value, description: o.description }))}
        onChange={(v) => setOption(v)}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginRight: theme.spacing(0.5),
  }),
  label: css({
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
