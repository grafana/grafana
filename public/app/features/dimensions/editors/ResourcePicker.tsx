import { css } from '@emotion/css';
import { useRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  InlineField,
  InlineFieldRow,
  Input,
  LinkButton,
  Popover,
  PopoverController,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { closePopover } from '@grafana/ui/src/utils/closePopover';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';

import { getPublicOrAbsoluteUrl } from '../resource';
import { MediaType, ResourceFolderName, ResourcePickerSize } from '../types';

import { ResourcePickerPopover } from './ResourcePickerPopover';

interface Props {
  onChange: (value?: string) => void;
  mediaType: MediaType;
  folderName: ResourceFolderName;
  size: ResourcePickerSize;
  onClear?: (event: React.MouseEvent) => void;
  value?: string; //img/icons/unicons/0-plus.svg
  src?: string;
  name?: string;
  placeholder?: string;
  color?: string;
  maxFiles?: number;
}

export const ResourcePicker = (props: Props) => {
  const { value, src, name, placeholder, onChange, onClear, mediaType, folderName, size, color, maxFiles } = props;

  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const pickerTriggerRef = useRef<HTMLDivElement>(null);
  const popoverElement = (props: { hidePopper?: () => void }) => {
    return (
      <ResourcePickerPopover
        onChange={onChange}
        value={value}
        mediaType={mediaType}
        folderName={folderName}
        maxFiles={maxFiles}
        hidePopper={props.hidePopper}
      />
    );
  };

  let sanitizedSrc = src;
  if (!sanitizedSrc && value) {
    sanitizedSrc = getPublicOrAbsoluteUrl(value);
  }

  const colorStyle = color && {
    fill: theme.visualization.getColorByName(color),
  };

  const renderSmallResourcePicker = () => {
    if (value && sanitizedSrc) {
      return <SanitizedSVG src={sanitizedSrc} className={styles.icon} style={{ ...colorStyle }} />;
    } else {
      return (
        <LinkButton variant="primary" fill="text" size="sm">
          Set icon
        </LinkButton>
      );
    }
  };

  const renderNormalResourcePicker = () => (
    <InlineFieldRow>
      <InlineField label={null} grow>
        <Input
          value={getDisplayName(src, name)}
          placeholder={placeholder}
          readOnly={true}
          prefix={sanitizedSrc && <SanitizedSVG src={sanitizedSrc} className={styles.icon} style={{ ...colorStyle }} />}
          suffix={<Button icon="times" variant="secondary" fill="text" size="sm" onClick={onClear} />}
        />
      </InlineField>
    </InlineFieldRow>
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
                onKeyDown={(event) => {
                  closePopover(event, hidePopper);
                }}
                hidePopper={hidePopper}
              />
            )}

            <div
              ref={pickerTriggerRef}
              className={styles.pointer}
              onClick={showPopper}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') {
                  showPopper();
                }
              }}
              role="button"
              tabIndex={0}
            >
              {size === ResourcePickerSize.SMALL && renderSmallResourcePicker()}
              {size === ResourcePickerSize.NORMAL && renderNormalResourcePicker()}
            </div>
          </>
        );
      }}
    </PopoverController>
  );
};

// strip the SVG off icons in the icons folder
function getDisplayName(src?: string, name?: string): string | undefined {
  if (src?.startsWith('public/img/icons')) {
    const idx = name?.lastIndexOf('.svg') ?? 0;
    if (idx > 0) {
      return name!.substring(0, idx);
    }
  }
  return name;
}

const getStyles = (theme: GrafanaTheme2) => ({
  pointer: css({
    cursor: 'pointer',
    'input[readonly]': {
      cursor: 'pointer',
    },
  }),
  icon: css({
    verticalAlign: 'middle',
    display: 'inline-block',
    fill: 'currentColor',
    width: '25px',
  }),
});
