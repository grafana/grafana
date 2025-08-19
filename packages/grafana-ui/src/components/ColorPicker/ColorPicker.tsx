import { css } from '@emotion/css';
import { Component, createRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { withTheme2 } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
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
  // This should be a React.RefObject<HTMLElement> but due to how object refs are defined you cannot downcast from that
  // to a specific type like React.RefObject<HTMLDivElement> even though it would be fine in runtime.
  ref: React.RefObject<any>;
  showColorPicker: () => void;
  hideColorPicker: () => void;
}) => React.ReactNode;

export const colorPickerFactory = <T extends ColorPickerProps>(
  popover: React.ComponentType<React.PropsWithChildren<T>>,
  displayName = 'ColorPicker'
) => {
  return class ColorPicker extends Component<T & { children?: ColorPickerTriggerRenderer }> {
    static displayName = displayName;
    pickerTriggerRef = createRef<any>();

    render() {
      const { theme, children, onChange, color, id } = this.props;
      const styles = getStyles(theme);
      const popoverElement = React.createElement(popover, {
        ...{ ...this.props, children: null },
        onChange,
      });
      return (
        <PopoverController content={popoverElement} hideAfter={300}>
          {(showPopper, hidePopper, popperProps) => {
            return (
              <>
                {this.pickerTriggerRef.current && (
                  <Popover
                    {...popperProps}
                    referenceElement={this.pickerTriggerRef.current}
                    wrapperClassName={styles.colorPicker}
                    onMouseLeave={hidePopper}
                    onMouseEnter={showPopper}
                    onKeyDown={(event) => closePopover(event, hidePopper)}
                  />
                )}

                {children ? (
                  children({
                    ref: this.pickerTriggerRef,
                    showColorPicker: showPopper,
                    hideColorPicker: hidePopper,
                  })
                ) : (
                  <ColorSwatch
                    id={id}
                    ref={this.pickerTriggerRef}
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
    }
  };
};

export const ColorPicker = withTheme2(colorPickerFactory(ColorPickerPopover, 'ColorPicker'));
export const SeriesColorPicker = withTheme2(colorPickerFactory(SeriesColorPickerPopover, 'SeriesColorPicker'));

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    colorPicker: css({
      position: 'absolute',
      zIndex: theme.zIndex.tooltip,
      color: theme.colors.text.primary,
      maxWidth: '400px',
      fontSize: theme.typography.size.sm,
    }),
  };
});
