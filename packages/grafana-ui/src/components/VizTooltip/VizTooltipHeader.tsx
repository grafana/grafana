import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { HeaderLabel } from './HeaderLabel';
import { VizTooltipHeaderLabelValue } from './VizTooltipHeaderLabelValue';
import { LabelValue } from './types';

interface Props {
  headerLabel: LabelValue;
  keyValuePairs?: LabelValue[];
  customValueDisplay?: ReactElement | null;
  isPinned: boolean;
}
export const VizTooltipHeader = ({ headerLabel, keyValuePairs, customValueDisplay, isPinned }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <HeaderLabel headerLabel={headerLabel} isPinned={isPinned} />
      {customValueDisplay || <VizTooltipHeaderLabelValue keyValuePairs={keyValuePairs} isPinned={isPinned} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: theme.spacing(1),
  }),
});
