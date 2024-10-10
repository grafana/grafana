import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ButtonSelect, useStyles2 } from '@grafana/ui';
import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { thresholdFunctions } from '../types';

export interface ThresholdSelectProps {
  onChange: (value: SelectableValue<EvalFunction>) => void;
  value: SelectableValue<EvalFunction> | undefined;
}
export function ThresholdSelect({ onChange, value }: ThresholdSelectProps) {
  const styles = useStyles2(getStyles);
  return (
    <ButtonSelect className={styles.buttonSelectText} options={thresholdFunctions} onChange={onChange} value={value} />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSelectText: css({
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    textTransform: 'uppercase',
    padding: `0 ${theme.spacing(1)}`,
  }),
});
