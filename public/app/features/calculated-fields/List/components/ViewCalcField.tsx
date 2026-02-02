import { css } from '@emotion/css';
import { FC } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { CalcFieldItem } from '../../types';

interface Props {
  item: CalcFieldItem;
}

export const ViewCalcField: FC<Props> = ({ item }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const extraInfo = [
    { label: t('bmc.calc-fields.name', 'Name'), value: item.name },
    { label: t('bmc.calc-fields.module', 'Module'), value: item.module },
    { label: t('bmc.calc-fields.form-name', 'Form name'), value: item.formName },
    { label: t('bmc.calc-fields.sql-query', 'SQL query'), value: item.sqlQuery },
    { label: t('bmc.calc-fields.aggregated', 'Aggregated'), value: String(item.Aggregation) },
  ];

  return (
    <div className={styles.content}>
      {extraInfo.map(
        (item) =>
          item.value && (
            <div className={styles.item} key={`${item.label} advanced info`}>
              <span className={styles.label}>{item.label}</span>
              <span className={styles.description}>{item.value}</span>
            </div>
          )
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  content: css`
    display: flex-wrap;
    align-items: right;
  `,
  item: css`
    margin-bottom: 20px;
    &:last-child {
      margin-bottom: 0;
    }
  `,
  label: css`
    label: Label;
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.weight.semibold};
    line-height: 1.25;
    color: ${theme.colors.formLabel};
    max-width: 480px;
  `,
  description: css`
    label: Label-description;
    color: ${theme.colors.formDescription};
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.weight.regular};
    display: block;
  `,
}));
