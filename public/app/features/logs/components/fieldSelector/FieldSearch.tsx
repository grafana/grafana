import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Field, IconButton, Input, useStyles2 } from '@grafana/ui';

interface Props {
  collapse(): void;
  onChange(e: React.FormEvent<HTMLInputElement>): void;
  value: string;
}

export function FieldSearch({ collapse, onChange, value }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <IconButton
        className={styles.iconExpanded}
        onClick={collapse}
        name="arrow-from-right"
        tooltip={t('logs.field-selector.collapse', 'Collapse sidebar')}
        size="sm"
      />
      <Field noMargin className={styles.searchWrap}>
        <Input
          value={value}
          type="text"
          placeholder={t('logs.field-selector.placeholder-search-fields-by-name', 'Search fields by name')}
          onChange={onChange}
        />
      </Field>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    iconExpanded: css({
      position: 'absolute',
      right: theme.spacing(0.2),
      top: theme.spacing(1),
      svg: {
        transform: 'rotate(-180deg)',
      },
    }),
    searchWrap: css({
      padding: `${theme.spacing(0.4)} 0 ${theme.spacing(0.4)} ${theme.spacing(0.4)}`,
      marginBottom: theme.spacing(2),
    }),
  };
}
