import { css } from '@emotion/css';
import { chain } from 'lodash';
import pluralize from 'pluralize';
import { useState } from 'react';
import tinycolor2 from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, IconButton, getTagColorsFromName, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { isPrivateLabel } from '../utils/labels';

import { Label, LabelSize } from './Label';

interface Props {
  labels: Record<string, string>;
  commonLabels?: Record<string, string>;
  size?: LabelSize;
  onLabelClick?: (label: string, value: string) => void;
}

export const AlertLabels = ({ labels, commonLabels = {}, size, onLabelClick }: Props) => {
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
    <div className={styles.wrapper} role="list" aria-label="Labels">
      {labelsToShow.map(([label, value]) => {
        const ariaLabel = t('central-alert-history.details.add-label-to-filter', 'Add label to the filter');
        const color = getLabelColor(label);
        return onLabelClick ? (
          <div
            role="button"
            tabIndex={0} // Make it focusable
            key={label + value}
            onClick={() => onLabelClick(label, value)}
            className={styles.labelContainer}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onLabelClick(label, value);
              }
            }}
          >
            <Label size={size} label={label} value={value} color={color} />
            <IconButton
              name="plus-circle"
              size="sm"
              onClick={() => onLabelClick(label, value)}
              aria-label={ariaLabel}
              tooltip={ariaLabel}
              className={styles.iconColor(color)}
            />
          </div>
        ) : (
          <Label key={label + value} size={size} label={label} value={value} color={getLabelColor(label)} />
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
    labelContainer: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      cursor: 'pointer',
    }),
    clickableLabel: css({
      cursor: 'pointer',
    }),
    iconColor: (color: string) => {
      const borderColor = theme.isDark
        ? tinycolor2(color).lighten(5).toString()
        : tinycolor2(color).darken(5).toString();

      const valueBackgroundColor = theme.isDark
        ? tinycolor2(color).darken(5).toString()
        : tinycolor2(color).lighten(5).toString();

      const fontColor = color ? tinycolor2.mostReadable(color, ['#000', '#fff']).toString() : theme.colors.text.primary;
      return css({
        backgroundColor: valueBackgroundColor,
        color: fontColor,
        borderColor,
        borderRadius: theme.shape.radius.circle,
      });
    },
  };
};
