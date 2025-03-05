import { css } from '@emotion/css';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { DataLinkButton, useStyles2 } from '@grafana/ui';
import { VizTooltipRow } from '@grafana/ui/src/components/VizTooltip/VizTooltipRow';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';

import { DisplayValue } from './DataHoverView';

export interface Props {
  displayValues: DisplayValue[];
  links?: LinkModel[];
  header?: string;
  maxHeight?: number;
}

export const ExemplarHoverView = ({ displayValues, links, header = 'Exemplar', maxHeight }: Props) => {
  const styles = useStyles2(getStyles, 0, maxHeight);

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
      {links && links.length > 0 && (
        <div className={styles.exemplarFooter}>
          {links.map((link, i) => (
            <DataLinkButton link={link} key={i} buttonProps={{ size: 'md' }} />
          ))}
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, padding = 0, maxHeight?: number) => {
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
      overflowY: 'auto',
      maxHeight: maxHeight,
    }),
    exemplarFooter: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.medium}`,
      gap: 4,
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
