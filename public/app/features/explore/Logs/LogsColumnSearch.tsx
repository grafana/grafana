import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Field, Input, useTheme2 } from '@grafana/ui/src';

function getStyles(theme: GrafanaTheme2) {
  return {
    searchWrap: css({
      padding: theme.spacing(0.4),
    }),
  };
}

export function LogsColumnSearch(props: { onChange: (e: React.FormEvent<HTMLInputElement>) => void }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <Field className={styles.searchWrap}>
      <Input type={'text'} placeholder={'Search fields by name'} onChange={props.onChange} />
    </Field>
  );
}
