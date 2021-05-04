// Libraries
import React, { ReactElement, useState } from 'react';
import { css } from '@emotion/css';

// Components
import { Tooltip } from '../Tooltip/Tooltip';

// Utils & Services
import { useStyles2 } from '../../themes/ThemeContext';

// Types
import { RelativeTimeRange, GrafanaThemeV2 } from '@grafana/data';
import { ToolbarButton } from '../Button';

export interface RelativeTimeRangePickerProps {
  timeRange: RelativeTimeRange;
  onChange: (timeRange: RelativeTimeRange) => void;
}

export function RelativeTimeRangePicker(props: RelativeTimeRangePickerProps): ReactElement | null {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <Tooltip content={'TBA'} placement="bottom">
        <ToolbarButton
          aria-label="TimePicker Open Button"
          onClick={() => setIsOpen(true)}
          icon="clock-nine"
          isOpen={isOpen}
        >
          <span className={styles.container}>
            <span>Add human readable version of timeRange</span>
          </span>
        </ToolbarButton>
      </Tooltip>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaThemeV2) => {
  return {
    container: css`
      position: relative;
      display: flex;
      vertical-align: middle;
    `,
  };
};
