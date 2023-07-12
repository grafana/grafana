import { css } from '@emotion/css';
import { chain } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getTagColorsFromName, useStyles2 } from '@grafana/ui';

import { Label, LabelSize } from './Label';

interface Props {
  labels: Record<string, string>;
  size?: LabelSize;
}

export const AlertLabels = ({ labels, size }: Props) => {
  const styles = useStyles2((theme) => getStyles(theme, size));
  const pairs = chain(labels).toPairs().reject(isPrivateKey).value();

  return (
    <div className={styles.wrapper} role="list" aria-label="Labels">
      {pairs.map(([label, value]) => (
        <Label key={label + value} size={size} label={label} value={value} color={getLabelColor(label)} />
      ))}
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

    gap: ${size === 'md' ? theme.spacing() : theme.spacing(0.5)};
  `,
});
