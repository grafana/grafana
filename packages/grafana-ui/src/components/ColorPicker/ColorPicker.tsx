import { css } from '@emotion/css';
import {
  type ComponentType,
  createElement,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  useRef,
} from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { closePopover } from '../../utils/closePopover';
import { Popover } from '../Tooltip/Popover';
import { PopoverController } from '../Tooltip/PopoverController';

import { ColorPickerPopover, ColorPickerProps } from './ColorPickerPopover';
import { ColorSwatch } from './ColorSwatch';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

/**
 * If you need custom trigger for the color picker you can do that with a render prop pattern and supply a function
 * as a child. You will get show/hide function which you can map to desired interaction (like onClick or onMouseLeave)
 * and a ref which needs to be passed to an HTMLElement for correct positioning. If you want to use class or functional
 * component as a custom trigger you will need to forward the reference to first HTMLElement child.
 */
type ColorPickerTriggerRenderer = (props: {
  // This should be a RefObject<HTMLElement> but due to how object refs are defined you cannot downcast from that
  // to a specific type like RefObject<HTMLDivElement> even though it would be fine in runtime.
  ref: RefObject<any>;
  showColorPicker: () => void;
  hideColorPicker: () => void;
}) => ReactNode;

export const colorPickerFactory = <T extends ColorPickerProps>(
  popover: ComponentType<PropsWithChildren<T>>,
  displayName = 'ColorPicker'
) => {
  const ColorPickerComponent = (props: T & { children?: ColorPickerTriggerRenderer }) => {
    const { children, onChange, color, id } = props;
    const theme = useTheme2();
    const pickerTriggerRef = useRef<any>(null);
    const styles = getStyles(theme);

    const popoverElement = createElement(
      popover,
      {
        ...props,
        onChange,
      },
      null
    );

    return (
      <PopoverController content={popoverElement} hideAfter={300}>
        {(showPopper, hidePopper, popperProps) => {
          return (
            <>
              {pickerTriggerRef.current && (
                <Popover
                  {...popperProps}
                  referenceElement={pickerTriggerRef.current}
                  wrapperClassName={styles.colorPicker}
                  onMouseLeave={hidePopper}
                  onMouseEnter={showPopper}
                  onKeyDown={(event) => closePopover(event, hidePopper)}
                />
              )}

              {children ? (
                children({
                  ref: pickerTriggerRef,
                  showColorPicker: showPopper,
                  hideColorPicker: hidePopper,
                })
              ) : (
                <ColorSwatch
                  id={id}
                  ref={pickerTriggerRef}
                  onClick={showPopper}
                  onMouseLeave={hidePopper}
                  color={theme.visualization.getColorByName(color || '#000000')}
                  aria-label={color}
                />
              )}
            </>
          );
        }}
      </PopoverController>
    );
  };

  return ColorPickerComponent;
};

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/pickers-colorpicker--docs
 */
export const ColorPicker = colorPickerFactory(ColorPickerPopover, 'ColorPicker');
export const SeriesColorPicker = colorPickerFactory(SeriesColorPickerPopover, 'SeriesColorPicker');

const getStyles = (theme: GrafanaTheme2) => {
  return {
    colorPicker: css({
      position: 'absolute',
      zIndex: theme.zIndex.tooltip,
      color: theme.colors.text.primary,
      maxWidth: '400px',
      fontSize: theme.typography.size.sm,
      maxHeight: '100vh',
      overflow: 'auto',
    }),
  };
};
