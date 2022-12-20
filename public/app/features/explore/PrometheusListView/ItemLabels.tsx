import { css } from '@emotion/css';
import React from 'react';

import { Field } from '@grafana/data/src';
import { stylesFactory, useStyles } from '@grafana/ui/src';

import { rawListItemColumnWidth } from './RawListItem';

const getItemLabelsStyles = stylesFactory((theme, expanded: boolean) => {
  return {
    valueNavigation: css`
      width: ${rawListItemColumnWidth};
      font-weight: bold;
    `,
    valueNavigationWrapper: css`
      display: flex;
      justify-content: flex-end;
    `,
    itemLabelsWrap: css`
      ${!expanded ? `border-bottom: 1px solid ${theme.colors.border3}` : ''};
    `,
  };
});

export const ItemLabels = ({ valueLabels, expanded }: { valueLabels: Field[]; expanded: boolean }) => {
  const styles = useStyles((theme) => getItemLabelsStyles(theme, expanded));
  return (
    <div className={styles.itemLabelsWrap}>
      <div className={styles.valueNavigationWrapper}>
        {valueLabels.map((value, index) => {
          return (
            <span className={styles.valueNavigation} key={index}>
              {value.name}
            </span>
          );
        })}
      </div>
    </div>
  );
};
