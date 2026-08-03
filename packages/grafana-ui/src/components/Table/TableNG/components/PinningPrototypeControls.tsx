import { css } from '@emotion/css';
import memoize from 'micro-memoize';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { RadioButtonGroup } from '../../../Forms/RadioButtonGroup/RadioButtonGroup';

export type PinningInteraction = 'menu' | 'divider' | 'both';

interface PinningPrototypeControlsProps {
  value: PinningInteraction;
  onChange: (value: PinningInteraction) => void;
}

const options: Array<SelectableValue<PinningInteraction>> = [
  { label: 'Menu', value: 'menu' },
  { label: 'Divider', value: 'divider' },
  { label: 'Both', value: 'both' },
];

export function PinningPrototypeControls({ value, onChange }: PinningPrototypeControlsProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <span className={styles.label}>{t('grafana-ui.table.pinning-prototype-label', 'Pin interaction')}</span>
      <RadioButtonGroup
        size="sm"
        options={options}
        value={value}
        onChange={onChange}
        aria-label={t('grafana-ui.table.pinning-prototype-label', 'Pin interaction')}
      />
    </div>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  container: css({
    label: 'pinningPrototypeControls',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  }),
}));
