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
}
export const VizTooltipHeader = ({ headerLabel, keyValuePairs, customValueDisplay }: Props) => {
  const styles = useStyles2(getStyles);

  const renderValue = () => {
    if (customValueDisplay) {
      return customValueDisplay;
    }

    return <VizTooltipHeaderLabelValue keyValuePairs={keyValuePairs} />;
  };
  return (
    <div className={styles.wrapper}>
      <HeaderLabel headerLabel={headerLabel} />
      {renderValue()}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    paddingBottom: theme.spacing(1),
  }),
});
