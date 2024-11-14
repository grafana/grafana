import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, useStyles2 } from '@grafana/ui';

type Props = {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string | undefined) => void;
};

export function BreakdownLabelSelector({ options, value, onChange }: Props) {
  const styles = useStyles2(getStyles);

  return <Select {...{ options, value }} onChange={(selected) => onChange(selected.value)} className={styles.select} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css({
      maxWidth: theme.spacing(16),
    }),
  };
}
