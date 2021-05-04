// Libraries
import React, { FormEvent, ReactElement, useCallback, useState } from 'react';
import { css } from '@emotion/css';

// Components
import { Tooltip } from '../Tooltip/Tooltip';

// Utils & Services
import { useStyles2 } from '../../themes/ThemeContext';

// Types
import { RelativeTimeRange, GrafanaThemeV2 } from '@grafana/data';
import { ButtonGroup, ToolbarButton } from '../Button';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

export interface RelativeTimeRangePickerProps {
  timeRange: RelativeTimeRange;
  onChange: (timeRange: RelativeTimeRange) => void;
}

export function RelativeTimeRangePicker(props: RelativeTimeRangePickerProps): ReactElement | null {
  const styles = useStyles2(getStyles);

  const [isOpen, setIsOpen] = useState(false);
  const onClose = useCallback(() => setIsOpen(false), []);

  const onOpen = useCallback(
    (event: FormEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen]
  );

  return (
    <ButtonGroup className={styles.container}>
      <Tooltip content={'TBA'} placement="bottom">
        <ToolbarButton aria-label="TimePicker Open Button" onClick={onOpen} icon="clock-nine" isOpen={isOpen}>
          <span className={styles.container}>
            <span>Add human readable version of timeRange</span>
          </span>
        </ToolbarButton>
      </Tooltip>
      {isOpen && (
        <ClickOutsideWrapper includeButtonPress={false} onClick={onClose}>
          <div className={styles.content}>
            <span>Content should go here</span>
          </div>
        </ClickOutsideWrapper>
      )}
    </ButtonGroup>
  );
}

const getStyles = (theme: GrafanaThemeV2) => {
  return {
    container: css`
      position: relative;
      display: flex;
      vertical-align: middle;
    `,
    content: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      width: 546px;
      top: 116%;
      border-radius: 2px;
      border: 1px solid ${theme.colors.border.weak};
      right: 0;
    `,
  };
};
