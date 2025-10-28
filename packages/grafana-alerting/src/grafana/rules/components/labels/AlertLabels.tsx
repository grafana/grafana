import { css } from '@emotion/css';
import { chain } from 'lodash';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Stack, Tooltip, useStyles2 } from '@grafana/ui';

import { findCommonLabels, isPrivateLabel } from '../../utils/labels';

import { AlertLabel, LabelSize } from './AlertLabel';

export interface AlertLabelsProps {
  labels: Record<string, string>;
  displayCommonLabels?: boolean;
  labelSets?: Array<Record<string, string>>;
  size?: LabelSize;
  onClick?: ([value, key]: [string | undefined, string | undefined]) => void;
  commonLabelsMode?: 'expand' | 'tooltip';
}

export const AlertLabels = ({
  labels,
  displayCommonLabels,
  labelSets,
  size,
  onClick,
  commonLabelsMode = 'expand',
}: AlertLabelsProps) => {
  const styles = useStyles2(getStyles, size);
  const [showCommonLabels, setShowCommonLabels] = useState(false);

  const computedCommonLabels =
    displayCommonLabels && Array.isArray(labelSets) && labelSets.length > 1 ? findCommonLabels(labelSets) : {};

  const labelsToShow = chain(labels)
    .toPairs()
    .reject(isPrivateLabel)
    .reject(([key]) => (showCommonLabels ? false : key in computedCommonLabels))
    .value();

  const commonLabelsCount = Object.keys(computedCommonLabels).length;
  const hasCommonLabels = commonLabelsCount > 0;
  const tooltip = t('alert-labels.button.show.tooltip', 'Show common labels');

  const commonLabelsTooltip = (
    <Stack role="list" direction="column" gap={1}>
      {Object.entries(computedCommonLabels).map(([label, value]) => {
        return (
          <AlertLabel key={label + value} size={size} labelKey={label} value={value} colorBy="key" role="listitem" />
        );
      })}
    </Stack>
  );

  return (
    <div className={styles.wrapper} role="list" aria-label={t('alerting.alert-labels.aria-label-labels', 'Labels')}>
      {labelsToShow.map(([label, value]) => {
        return (
          <AlertLabel
            key={label + value}
            size={size}
            labelKey={label}
            value={value}
            colorBy="key"
            onClick={onClick}
            role="listitem"
          />
        );
      })}

      {!showCommonLabels && hasCommonLabels && (
        <div role="listitem">
          {commonLabelsMode === 'expand' ? (
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
          ) : (
            <Tooltip content={commonLabelsTooltip} placement="top">
              <Button variant="secondary" fill="text" size="sm">
                <Trans i18nKey="alerting.alert-labels.common-labels-count" count={commonLabelsCount}>
                  +{'{{count}}'} common labels
                </Trans>
              </Button>
            </Tooltip>
          )}
        </div>
      )}
      {showCommonLabels && hasCommonLabels && (
        <div role="listitem">
          <Button
            variant="secondary"
            fill="text"
            onClick={() => setShowCommonLabels(false)}
            tooltipPlacement="top"
            size="sm"
          >
            <Trans i18nKey="alert-labels.button.hide">Hide common labels</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};

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
