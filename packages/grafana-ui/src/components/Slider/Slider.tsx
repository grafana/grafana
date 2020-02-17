import React, { PureComponent } from 'react';
import ReactSlider from 'react-slider';
import { css, cx } from 'emotion';
import { stylesFactory, withTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { Themeable } from '../../types';

const getStyles = stylesFactory((theme: GrafanaTheme, size: string, orientation: string, index?: number) => {
  const textColor = theme.isLight ? theme.colors.black : theme.colors.white;
  const bgColorNonActive = theme.isLight ? theme.colors.white : theme.colors.black;
  const borderColorNonActive = theme.isLight ? theme.colors.gray5 : theme.colors.dark6;
  const colorSelected = theme.colors.blue77;

  /* Based on the index passed from the renderTrack, we can add specific styling for each track between thumbs.
    Currently, we use only one color for selected area, as  our slider supports only 1 range (2 thumbs).
    We can add support for more thumbs in the future, if needed
  */
  const bg = index ? (index === 1 ? colorSelected : bgColorNonActive) : bgColorNonActive;
  const border = index ? (index === 1 ? colorSelected : borderColorNonActive) : borderColorNonActive;

  const isHorizontal = orientation === 'horizontal';
  const sliderOrientationSpecific = isHorizontal
    ? css`
        height: 16px;
        width: ${size};
        margin: ${theme.spacing.xl} ${theme.spacing.md} ${theme.spacing.md};
        justify-content: center;
      `
    : css`
        height: ${size};
        width: 16px;
        margin: ${theme.spacing.md} ${theme.spacing.xl} ${theme.spacing.md};
        align-items: center;
      `;

  const thumbOrientationSpecific = isHorizontal
    ? css`
        top: 0;
      `
    : css`
        left: 0;
      `;

  const trackOrientationSpecific = isHorizontal
    ? css`
        top: 5px;
        height: 6px;
      `
    : css`
        left: 5px;
        width: 6px;
      `;

  const textOrientationSpecific = isHorizontal
    ? css`
        margin-top: -20px;
      `
    : css`
        margin-left: 20px;
      `;

  return {
    slider: css`
      background-color: transparent;
    `,
    thumb: css`
      height: 16px;
      line-height: 16px;
      width: 16px;
      display: flex;
      background-color: ${colorSelected};
      color: ${textColor};
      border-radius: 50%;
      cursor: grab;
    `,
    track: css`
      background: ${bg};
      border: 1px solid ${border};
      border-radius: 999px;
    `,
    text: css`
      font-size: ${theme.typography.size.sm};
      width: 16px;
      height: 16px;
      text-align: center;
    `,
    sliderSpecific: sliderOrientationSpecific,
    thumbSpecific: thumbOrientationSpecific,
    trackSpecific: trackOrientationSpecific,
    textSpecific: textOrientationSpecific,
  };
});

export interface Props extends Themeable {
  min: number;
  max: number;
  orientation: 'horizontal' | 'vertical';
  // If 1 value is pre-selected in slider should be different than min a mix
  size?: string;
  // To style and format tooltip results
  classNameTooltip?: string;
  formatTooltipResult?: (value: number) => number | string;
  onChange?: ((value: number | number[] | null | undefined) => void) | undefined;
}

class UnThemedSlider extends PureComponent<Props> {
  render() {
    const { theme, orientation, min, max, onChange, size, classNameTooltip, formatTooltipResult } = this.props;
    const sliderSize = size || '250px';
    const styles = getStyles(theme, sliderSize, orientation);

    const Track = (props: any) => {
      const trackStyle = getStyles(theme, sliderSize, orientation, props.index);
      return (
        <div
          {...props}
          className={cx(trackStyle.track, trackStyle.trackSpecific, props.className)}
          style={props.style}
        ></div>
      );
    };

    const Thumb = (props: any, state: any) => (
      <div {...props} className={cx(styles.thumb, styles.thumbSpecific)}>
        <div className={cx(styles.text, styles.textSpecific, classNameTooltip && classNameTooltip)}>
          {formatTooltipResult ? formatTooltipResult(state.valueNow) : state.valueNow}
        </div>
      </div>
    );

    return (
      <ReactSlider
        className={cx(styles.slider, styles.sliderSpecific)}
        defaultValue={[min, max]}
        renderTrack={(props, state) => <Track {...props} index={state.index}></Track>}
        renderThumb={Thumb}
        orientation={orientation}
        max={max}
        min={min}
        onChange={onChange}
      />
    );
  }
}

export const Slider = withTheme(UnThemedSlider);
Slider.displayName = 'Slider';
