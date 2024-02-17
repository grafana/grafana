import { css } from '@emotion/css';
import { chain } from 'lodash';
import pluralize from 'pluralize';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, getTagColorsFromName, useStyles2 } from '@grafana/ui';

import { Label, LabelSize } from './Label';

interface Props {
  labels: Record<string, string>;
  commonLabels?: Record<string, string>;
  size?: LabelSize;
}

export const AlertLabels = ({ labels, commonLabels = {}, size }: Props) => {
  const styles = useStyles2(getStyles, size);
  const [showCommonLabels, setShowCommonLabels] = useState(false);

  const labelsToShow = chain(labels)
    .toPairs()
    .reject(isPrivateKey)
    .reject(([key]) => (showCommonLabels ? false : key in commonLabels))
    .value();

  const commonLabelsCount = Object.keys(commonLabels).length;
  const hasCommonLabels = commonLabelsCount > 0;

  return (
    <div className={styles.wrapper} role="list" aria-label="Labels">
      {labelsToShow.map(([label, value]) => (
        <Label key={label + value} size={size} label={label} value={value} color={getLabelColor(label)} />
      ))}
      {!showCommonLabels && hasCommonLabels && (
        <Button
          variant="secondary"
          fill="text"
          onClick={() => setShowCommonLabels(true)}
          tooltip="Show common labels"
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
          Hide common labels
        </Button>
      )}
    </div>
  );
};

function getLabelColor(input: string): string {
  return getTagColorsFromName(input).color;
}

const isPrivateKey = ([key, _]: [string, string]) => key.startsWith('__') && key.endsWith('__');

const getStyles = (theme: GrafanaTheme2, size?: LabelSize) => ({
  wrapper: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;

    gap: ${size === 'md' ? theme.spacing() : theme.spacing(0.5)};
  `,
});
