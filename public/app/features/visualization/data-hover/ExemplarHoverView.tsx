import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { VizTooltipRow } from '@grafana/ui/src/components/VizTooltip/VizTooltipRow';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';

import { DisplayValue } from './DataHoverView';

export interface Props {
  displayValues: DisplayValue[];
  links?: LinkModel[];
  header?: string;
}

export const ExemplarHoverView = ({ displayValues, links, header = 'Exemplar' }: Props) => {
  const styles = useStyles2(getStyles);

  const time = displayValues.find((val) => val.name === 'Time');
  displayValues = displayValues.filter((val) => val.name !== 'Time'); // time?

  return (
    <div className={styles.exemplarWrapper}>
      <div className={styles.exemplarHeader}>
        <span className={styles.title}>{header}</span>
        {time && <span className={styles.time}>{renderValue(time.valueString)}</span>}
      </div>
      <div className={styles.exemplarContent}>
        {displayValues.map((displayValue, i) => {
          return (
            <VizTooltipRow
              key={i}
              label={displayValue.name}
              value={renderValue(displayValue.valueString)}
              justify={'space-between'}
              isPinned={false}
            />
          );
        })}
      </div>
      {links && (
        <div className={styles.exemplarFooter}>
          {links.map((link, i) => (
            <LinkButton key={i} href={link.href} className={styles.linkButton}>
              {link.title}
            </LinkButton>
          ))}
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, padding = 0) => {
  return {
    exemplarWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      gap: 4,
      whiteSpace: 'pre',
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: `0 4px 8px ${theme.colors.background.primary}`,
    }),
    exemplarHeader: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      padding: theme.spacing(1),
    }),
    time: css({
      color: theme.colors.text.primary,
    }),
    exemplarContent: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      gap: 4,
      borderTop: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(1),
    }),
    exemplarFooter: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      borderTop: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(1),

      overflowX: 'auto',
      overflowY: 'hidden',
      whiteSpace: 'nowrap',
    }),
    linkButton: css({
      width: 'fit-content',
    }),
    label: css({
      color: theme.colors.text.secondary,
      fontWeight: 400,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      marginRight: theme.spacing(0.5),
    }),
    value: css({
      fontWeight: 500,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
    title: css({
      fontWeight: theme.typography.fontWeightMedium,
      overflow: 'hidden',
      display: 'inline-block',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      flexGrow: 1,
    }),
  };
};
