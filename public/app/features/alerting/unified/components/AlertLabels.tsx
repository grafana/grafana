import { css } from '@emotion/css';
import { chain } from 'lodash';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, getTagColorsFromName, useStyles2 } from '@grafana/ui';

import { isPrivateLabel } from '../utils/labels';

import { Label, LabelSize } from './Label';

interface Props {
  labels: Record<string, string>;
  commonLabels?: Record<string, string>;
  size?: LabelSize;
  onClick?: (label: string, value: string) => void;
}

export const AlertLabels = ({ labels, commonLabels = {}, size, onClick }: Props) => {
  const styles = useStyles2(getStyles, size);
  const [showCommonLabels, setShowCommonLabels] = useState(false);

  const labelsToShow = chain(labels)
    .toPairs()
    .reject(isPrivateLabel)
    .reject(([key]) => (showCommonLabels ? false : key in commonLabels))
    .value();

  const commonLabelsCount = Object.keys(commonLabels).length;
  const hasCommonLabels = commonLabelsCount > 0;
  const tooltip = t('alert-labels.button.show.tooltip', 'Show common labels');

  return (
    <div className={styles.wrapper} role="list" aria-label={t('alerting.alert-labels.aria-label-labels', 'Labels')}>
      {labelsToShow.map(([label, value]) => {
        return (
          <Label
            key={label + value}
            size={size}
            label={label}
            value={value}
            color={getLabelColor(label)}
            onClick={onClick}
          />
        );
      })}

      {!showCommonLabels && hasCommonLabels && (
        <Button
          variant="secondary"
          fill="text"
          onClick={() => setShowCommonLabels(true)}
          tooltip={tooltip}
          tooltipPlacement="top"
          size="sm"
        >
          <Trans i18nKey="alerting.alert-labels.common-labels-count" count={commonLabelsCount}>
            +{'{{count}}'} common labels
          </Trans>
        </Button>
      )}
      {showCommonLabels && hasCommonLabels && (
        <Button
          variant="secondary"
          fill="text"
          onClick={() => setShowCommonLabels(false)}
          tooltipPlacement="top"
          size="sm"
        >
          <Trans i18nKey="alert-labels.button.hide">Hide common labels</Trans>
        </Button>
      )}
    </div>
  );
};

function getLabelColor(input: string): string {
  return getTagColorsFromName(input).color;
}

const getStyles = (theme: GrafanaTheme2, size?: LabelSize) => {
  return {
    wrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',

      gap: size === 'md' ? theme.spacing() : theme.spacing(0.5),
    }),
  };
};
