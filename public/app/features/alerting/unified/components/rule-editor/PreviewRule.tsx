import React, { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { dateTimeFormatISO, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { RuleFormType } from '../../types/rule-form';

const fields: string[] = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];

export function PreviewRule(): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const { getValues } = useFormContext();

  const onPreview = useCallback(async () => {
    const [type, dataSourceName, condition, queries, expression] = getValues(fields);
  }, [getValues]);

  return (
    <div className={styles.container}>
      <HorizontalGroup>
        <Button type="button" variant="primary" onClick={onPreview}>
          Preview your alert
        </Button>
      </HorizontalGroup>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      margin-top: ${theme.spacing(2)};
    `,
  };
}
