import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Field, Input, useTheme2 } from '@grafana/ui/src';

function getStyles(theme: GrafanaTheme2) {
  return {
    searchWrap: css({
      padding: `${theme.spacing(0.4)} 0 ${theme.spacing(0.4)} ${theme.spacing(0.4)}`,
    }),
  };
}

export function LogsColumnSearch(props: { onChange: (e: React.FormEvent<HTMLInputElement>) => void; value: string }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <Field className={styles.searchWrap}>
      <Input value={props.value} type={'text'} placeholder={'Search fields by name'} onChange={props.onChange} />
    </Field>
  );
}
