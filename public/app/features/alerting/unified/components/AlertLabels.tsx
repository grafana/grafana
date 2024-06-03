import { css } from '@emotion/css';
import { chain } from 'lodash';
import pluralize from 'pluralize';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, getTagColorsFromName, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { isPrivateLabel } from '../utils/labels';

import { Label, LabelSize } from './Label';

interface Props {
  labels: Record<string, string>;
  commonLabels?: Record<string, string>;
  size?: LabelSize;
  limit?: number;
}

export const AlertLabels = ({ labels, commonLabels = {}, size, limit }: Props) => {
  const styles = useStyles2(getStyles, size);
  const [showCommonLabels, setShowCommonLabels] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);

  const labelsToShow = chain(labels)
    .toPairs()
    .reject(isPrivateLabel)
    .reject(([key]) => (showCommonLabels ? false : key in commonLabels))
    .value();

  const commonLabelsCount = Object.keys(commonLabels).length;
  const hasCommonLabels = commonLabelsCount > 0;
  const labelsToShowLimited = showAllLabels ? labelsToShow : labelsToShow.slice(0, limit);
  const tooltip = t('alert-labels.button.show.tooltip', 'Show common labels');

  return (
    <div className={styles.wrapper} role="list" aria-label="Labels">
      {labelsToShowLimited.map(([label, value]) => (
        <Label key={label + value} size={size} label={label} value={value} color={getLabelColor(label)} />
      ))}
      {!showCommonLabels && hasCommonLabels && (
        <Button
          variant="secondary"
          fill="text"
          onClick={() => setShowCommonLabels(true)}
          tooltip={tooltip}
          tooltipPlacement="top"
          size="sm"
        >
          +{commonLabelsCount} common {pluralize('label', commonLabelsCount)}
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
          <Trans i18nKey="alert-labels.button.hide"> Hide common labels</Trans>
        </Button>
      )}
      {showAllLabels && Boolean(limit) && (
        <Button
          variant="secondary"
          fill="text"
          onClick={() => setShowAllLabels(false)}
          tooltipPlacement="top"
          size="sm"
        >
          <Trans i18nKey="alert-labels.button.show-all"> Show less labels</Trans>
        </Button>
      )}
      {!showAllLabels && limit && labelsToShow.length > limit && (
        <Button variant="secondary" fill="text" onClick={() => setShowAllLabels(true)} tooltipPlacement="top" size="sm">
          +{labelsToShow.length - limit} <Trans i18nKey="alert-labels.button.more">more</Trans>
        </Button>
      )}
    </div>
  );
};

function getLabelColor(input: string): string {
  return getTagColorsFromName(input).color;
}

const getStyles = (theme: GrafanaTheme2, size?: LabelSize) => ({
  wrapper: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',

    gap: size === 'md' ? theme.spacing() : theme.spacing(0.5),
  }),
});
