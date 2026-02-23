import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Stack, Icon, IconButton, Tooltip, useTheme2 } from '@grafana/ui';

import { QueryValidator, QueryValidatorProps } from './QueryValidator';

interface QueryToolboxProps extends Omit<QueryValidatorProps, 'onValidate'> {
  showTools?: boolean;
  isExpanded?: boolean;
  onFormatCode?: () => void;
  onExpand?: (expand: boolean) => void;
  onValidate?: (isValid: boolean) => void;
}

export function QueryToolbox({ showTools, onFormatCode, onExpand, isExpanded, ...validatorProps }: QueryToolboxProps) {
  const theme = useTheme2();
  const [validationResult, setValidationResult] = useState<boolean>();

  const styles = useMemo(() => {
    return {
      container: css({
        border: `1px solid ${theme.colors.border.medium}`,
        borderTop: 'none',
        padding: theme.spacing(0.5, 0.5, 0.5, 0.5),
        display: 'flex',
        flexGrow: 1,
        justifyContent: 'space-between',
        fontSize: theme.typography.bodySmall.fontSize,
      }),
      error: css({
        color: theme.colors.error.text,
        fontSize: theme.typography.bodySmall.fontSize,
        fontFamily: theme.typography.fontFamilyMonospace,
      }),
      valid: css({
        color: theme.colors.success.text,
      }),
      info: css({
        color: theme.colors.text.secondary,
      }),
      hint: css({
        color: theme.colors.text.disabled,
        whiteSpace: 'nowrap',
        cursor: 'help',
      }),
    };
  }, [theme]);

  let style = {};

  if (!showTools && validationResult === undefined) {
    style = { height: 0, padding: 0, visibility: 'hidden' };
  }

  return (
    <div className={styles.container} style={style}>
      <div>
        {validatorProps.onValidate && (
          <QueryValidator
            {...validatorProps}
            onValidate={(result: boolean) => {
              setValidationResult(result);
              validatorProps.onValidate!(result);
            }}
          />
        )}
      </div>
      {showTools && (
        <div>
          <Stack gap={1}>
            {onFormatCode && (
              <IconButton
                onClick={() => {
                  reportInteraction('grafana_sql_query_formatted', {
                    datasource: validatorProps.query.datasource?.type,
                  });
                  onFormatCode();
                }}
                name="brackets-curly"
                size="xs"
                tooltip={t('grafana-sql.components.query-toolbox.tooltip-format-query', 'Format query')}
              />
            )}
            {onExpand && (
              <IconButton
                onClick={() => {
                  reportInteraction('grafana_sql_editor_expand', {
                    datasource: validatorProps.query.datasource?.type,
                    expanded: !isExpanded,
                  });

                  onExpand(!isExpanded);
                }}
                name={isExpanded ? 'angle-up' : 'angle-down'}
                size="xs"
                tooltip={
                  isExpanded
                    ? t('grafana-sql.components.query-toolbox.tooltip-collapse', 'Collapse editor')
                    : t('grafana-sql.components.query-toolbox.tooltip-expand', 'Expand editor')
                }
              />
            )}
            <Tooltip
              content={t(
                'grafana-sql.components.query-toolbox.content-hit-ctrlcmdreturn-to-run-query',
                'Hit CTRL/CMD+Return to run query'
              )}
            >
              <Icon className={styles.hint} name="keyboard" />
            </Tooltip>
          </Stack>
        </div>
      )}
    </div>
  );
}
