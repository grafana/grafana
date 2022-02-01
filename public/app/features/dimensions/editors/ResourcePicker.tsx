import React, { createRef } from 'react';
import { css } from '@emotion/css';
import { Button, InlineField, InlineFieldRow, Input, Popover, PopoverController, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import SVG from 'react-inlinesvg';

import { MediaType, ResourceFolderName } from '../types';
import { closePopover } from '@grafana/ui/src/utils/closePopover';
import { ResourcePickerPopover } from './ResourcePickerPopover';

interface Props {
  value?: string; //img/icons/unicons/0-plus.svg
  src?: string;
  name?: string;
  placeholder?: string;
  onChange: (value?: string) => void;
  onClear: (event: React.MouseEvent) => void;
  mediaType: MediaType;
  folderName: ResourceFolderName;
}

export const ResourcePicker = (props: Props) => {
  const { value, src, name, placeholder, onChange, onClear, mediaType, folderName } = props;

  const styles = useStyles2(getStyles);

  const pickerTriggerRef = createRef<any>();
  const popoverElement = (
    <ResourcePickerPopover onChange={onChange} value={value} mediaType={mediaType} folderName={folderName} />
  );

  return (
    <PopoverController content={popoverElement}>
      {(showPopper, hidePopper, popperProps) => {
        return (
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

            <div ref={pickerTriggerRef} onClick={showPopper}>
              <InlineFieldRow className={styles.pointer}>
                <InlineField label={null} grow>
                  <Input
                    value={name}
                    placeholder={placeholder}
                    readOnly={true}
                    prefix={src && <SVG src={src} className={styles.icon} />}
                    suffix={<Button icon="times" variant="secondary" fill="text" size="sm" onClick={onClear} />}
                  />
                </InlineField>
              </InlineFieldRow>
            </div>
          </>
        );
      }}
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
  icon: css`
    vertical-align: middle;
    display: inline-block;
    fill: currentColor;
    max-width: 25px;
  `,
});
