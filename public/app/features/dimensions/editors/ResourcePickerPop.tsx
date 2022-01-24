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

export const ResourcePickerPop = (props: Props) => {
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
    <PopoverController content={popoverElement} hideAfter={300}>
      {(showPopper, hidePopper, popperProps) => {
        return (
          <>
            {pickerTriggerRef.current && (
              <Popover
                {...popperProps}
                referenceElement={pickerTriggerRef.current}
                onMouseLeave={hidePopper}
                onMouseEnter={showPopper}
                onKeyDown={(event: any) => closePopover(event, hidePopper)}
              />
            )}

            <div ref={pickerTriggerRef} onClick={showPopper}>
              Test click
            </div>
            <InlineFieldRow
              ref={pickerTriggerRef}
              onClick={showPopper}
              onMouseLeave={hidePopper}
              className={styles.pointer}
            >
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
          </>
        );
      }}
    </PopoverController>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    cardsWrapper: css`
      height: 30vh;
      min-height: 50px;
      margin-top: 5px;
      max-width: 680px;
    `,
    tabContent: css`
      margin-top: 20px;
      & > :nth-child(2) {
        margin-top: 10px;
      },
    `,
    iconPreview: css`
      width: 95px;
      height: 79px;
      border: 1px solid ${theme.colors.border.medium};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    iconContainer: css`
      display: flex;
      flex-direction: column;
      width: 40%;
      align-items: center;
    `,
    img: css`
      width: 49px;
      height: 49px;
      fill: ${theme.colors.text.primary};
    `,
    child: css`
      width: 60%;
    `,
    upper: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
    `,
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
