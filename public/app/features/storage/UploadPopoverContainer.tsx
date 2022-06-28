import { css } from '@emotion/css';
import React, { createRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Popover, PopoverController, useTheme2 } from '@grafana/ui';
import { closePopover } from '@grafana/ui/src/utils/closePopover';

import { UploadPopover } from './UploadPopover';

interface Props {
  onUpload: () => void;
  onClose: () => void;
  disabled?: boolean;
}

export const UploadPopoverContainer = (props: Props) => {
  const { onUpload, onClose, disabled } = props;

  const theme = useTheme2();
  const styles = getStyles(theme);

  const pickerTriggerRef = createRef<any>();
  const popoverElement = <UploadPopover onClose={onClose} onUpload={onUpload} />;

  return (
    <PopoverController content={popoverElement}>
      {(showPopper, hidePopper, popperProps) => (
        <>
          {pickerTriggerRef.current && (
            <Popover
              {...popperProps}
              referenceElement={pickerTriggerRef.current}
              onMouseEnter={showPopper}
              onKeyDown={(event: any) => {
                closePopover(event, hidePopper);
              }}
            />
          )}

          <Button
            disabled={disabled}
            icon={'upload'}
            ref={pickerTriggerRef}
            className={styles.pointer}
            variant={'primary'}
            onClick={showPopper}
          >
            Upload
          </Button>
        </>
      )}
    </PopoverController>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  pointer: css`
    cursor: pointer;
    input[readonly] {
      cursor: pointer;
    }
  `,
});
