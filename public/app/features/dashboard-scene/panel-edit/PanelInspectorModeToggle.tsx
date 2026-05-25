import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';

export type InspectorMode = 'basic' | 'advanced';

interface Props {
  mode: InspectorMode;
  onChangeMode: (mode: InspectorMode) => void;
}

export function PanelInspectorModeToggle({ mode, onChangeMode }: Props) {
  const styles = useStyles2(getStyles);

  const options = [
    { label: t('panel-edit.inspector-mode.basic', 'Basic'), value: 'basic' as const, icon: 'magic' as const },
    {
      label: t('panel-edit.inspector-mode.advanced', 'Advanced'),
      value: 'advanced' as const,
      icon: 'sliders-v-alt' as const,
    },
  ];

  return (
    <div className={styles.wrapper}>
      <RadioButtonGroup options={options} value={mode} onChange={onChangeMode} size="sm" fullWidth />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      padding: theme.spacing(1, 1.25),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
