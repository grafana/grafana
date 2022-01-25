import React, { createRef } from 'react';
import { css } from '@emotion/css';
import {
  Button,
  InlineField,
  InlineFieldRow,
  Input,
  Popover,
  PopoverController,
  stylesFactory,
  useStyles2,
} from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import SVG from 'react-inlinesvg';

import { ResourceFolderName } from '..';
import { closePopover } from '@grafana/ui/src/utils/closePopover';
import { ResourcePickerPopover } from './ResourcePickerPopover';

interface Props {
  value?: string; //img/icons/unicons/0-plus.svg
  srcPath?: string;
  niceName?: string;
  placeholder?: string;
  onChange: (value?: string) => void;
  onClear: (event: React.MouseEvent) => void;
  mediaType: 'icon' | 'image';
  folderName: ResourceFolderName;
}

export const ResourcePicker = (props: Props) => {
  const pickerTriggerRef = createRef<any>();
  const popoverElement = (
    <ResourcePickerPopover
      onChange={props.onChange}
      value={props.value}
      mediaType={props.mediaType}
      folderName={props.folderName}
    />
  );
  const styles = useStyles2(getStyles);

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
                    value={props.niceName}
                    placeholder={props.placeholder}
                    readOnly={true}
                    prefix={props.srcPath && <SVG src={props.srcPath} className={styles.icon} />}
                    suffix={<Button icon="times" variant="secondary" fill="text" size="sm" onClick={props.onClear} />}
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

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
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
  };
});
