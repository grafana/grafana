import { css } from '@emotion/css';
import clsx from 'clsx';
import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { InlineToast } from '../InlineToast/InlineToast';
import { Tooltip } from '../Tooltip/Tooltip';

import { ColorIndicatorPosition, VizTooltipColorIndicator } from './VizTooltipColorIndicator';
import { ColorPlacement, VizTooltipItem } from './types';

interface VizTooltipRowProps extends Omit<VizTooltipItem, 'value'> {
  value: string | number | null | ReactNode;
  justify?: string;
  isActive?: boolean; // for series list
  marginRight?: string;
  isPinned: boolean;
  showValueScroll?: boolean;
  isHiddenFromViz?: boolean;
}

enum LabelValueTypes {
  label = 'label',
  value = 'value',
}

const SUCCESSFULLY_COPIED_TEXT = 'Copied to clipboard';
const SHOW_SUCCESS_DURATION = 2 * 1000;
const HORIZONTAL_PX_PER_CHAR = 7;
const CAN_COPY = Boolean(navigator.clipboard && window.isSecureContext);

export const VizTooltipRow = ({
  label,
  value,
  color,
  colorIndicator,
  colorPlacement = ColorPlacement.first,
  justify,
  isActive = false,
  marginRight,
  isPinned,
  lineStyle,
  showValueScroll,
  isHiddenFromViz,
}: VizTooltipRowProps) => {
  const styles = useStyles2(getStyles, justify, marginRight);

  const innerValueScrollStyle: CSSProperties = showValueScroll
    ? {
        maxHeight: 55,
        whiteSpace: 'wrap',
        wordBreak: 'break-word',
        overflowY: 'auto',
      }
    : {
        whiteSpace: 'pre-line',
        wordBreak: 'break-word',
        lineHeight: 1.2,
      };

  const [showLabelTooltip, setShowLabelTooltip] = useState(false);

  const [copiedText, setCopiedText] = useState<Record<string, string> | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const labelRef = useRef<null | HTMLDivElement>(null);
  const valueRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (showCopySuccess) {
      timeoutId = setTimeout(() => {
        setShowCopySuccess(false);
      }, SHOW_SUCCESS_DURATION);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showCopySuccess]);

  const copyToClipboard = async (text: string, type: LabelValueTypes) => {
    if (!CAN_COPY) {
      fallbackCopyToClipboard(text, type);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText({ [`${type}`]: text });
      setShowCopySuccess(true);
    } catch (error) {
      setCopiedText(null);
    }
  };

  const fallbackCopyToClipboard = (text: string, type: LabelValueTypes) => {
    // Use a fallback method for browsers/contexts that don't support the Clipboard API.
    const textarea = document.createElement('textarea');
    labelRef.current?.appendChild(textarea);
    textarea.value = text;
    textarea.focus();
    textarea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopiedText({ [`${type}`]: text });
        setShowCopySuccess(true);
      }
    } catch (err) {
      console.error('Unable to copy to clipboard', err);
    }

    textarea.remove();
  };

  const onMouseEnterLabel = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget.offsetWidth < event.currentTarget.scrollWidth) {
      setShowLabelTooltip(true);
    }
  };

  const onMouseLeaveLabel = () => setShowLabelTooltip(false);

  // if label is > 50% window width, try to put label/value pairs on new lines
  if (label.length * HORIZONTAL_PX_PER_CHAR > window.innerWidth / 2) {
    label = label.replaceAll('{', '{\n  ').replaceAll('}', '\n}').replaceAll(', ', ',\n  ');
  }

  return (
    <div className={styles.contentWrapper}>
      {color && colorPlacement === ColorPlacement.first && (
        <div className={styles.colorWrapper}>
          <VizTooltipColorIndicator
            color={color}
            colorIndicator={colorIndicator}
            lineStyle={lineStyle}
            isHollow={isHiddenFromViz}
          />
        </div>
      )}
      {label && (
        <div className={styles.labelWrapper}>
          {!isPinned ? (
            <div className={clsx(styles.label, isActive ? styles.activeSeries : '')}>{label}</div>
          ) : (
            <>
              <Tooltip content={label} interactive={false} show={showLabelTooltip}>
                <>
                  {showCopySuccess && copiedText?.label && (
                    <InlineToast placement="top" referenceElement={labelRef.current}>
                      {SUCCESSFULLY_COPIED_TEXT}
                    </InlineToast>
                  )}
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                  <div
                    className={clsx(styles.label, isActive ? styles.activeSeries : '', CAN_COPY ? styles.copy : '')}
                    onMouseEnter={onMouseEnterLabel}
                    onMouseLeave={onMouseLeaveLabel}
                    onClick={() => copyToClipboard(label, LabelValueTypes.label)}
                    ref={labelRef}
                  >
                    {label}
                  </div>
                </>
              </Tooltip>
            </>
          )}
        </div>
      )}

      <div className={styles.valueWrapper}>
        {color && colorPlacement === ColorPlacement.leading && (
          <VizTooltipColorIndicator
            color={color}
            colorIndicator={colorIndicator}
            position={ColorIndicatorPosition.Leading}
            lineStyle={lineStyle}
          />
        )}

        {!isPinned ? (
          <div className={styles.value} style={innerValueScrollStyle}>
            {value}
          </div>
        ) : (
          <>
            {showCopySuccess && copiedText?.value && (
              <InlineToast placement="top" referenceElement={valueRef.current}>
                {SUCCESSFULLY_COPIED_TEXT}
              </InlineToast>
            )}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <div
              className={clsx(styles.value, CAN_COPY ? styles.copy : '')}
              style={innerValueScrollStyle}
              onClick={() => copyToClipboard(value ? value.toString() : '', LabelValueTypes.value)}
              ref={valueRef}
            >
              {value}
            </div>
          </>
        )}

        {color && colorPlacement === ColorPlacement.trailing && (
          <VizTooltipColorIndicator
            color={color}
            colorIndicator={colorIndicator}
            position={ColorIndicatorPosition.Trailing}
            lineStyle={lineStyle}
          />
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, justify = 'start', marginRight?: string) => ({
  contentWrapper: css({
    display: 'flex',
    maxWidth: '100%',
    alignItems: 'start',
    justifyContent: justify,
    columnGap: '6px',
  }),
  label: css({ display: 'inline' }),
  value: css({
    fontWeight: 500,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  colorWrapper: css({
    alignSelf: 'center',
    position: 'relative',
    flexShrink: 0,
    top: -2, // half the height of the color indicator, since the top is aligned with flex center.
    marginRight: '-6px', // account for the built-in column-gap in relation to the color indicator's margin
  }),
  labelWrapper: css({
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: theme.colors.text.secondary,
    fontWeight: 400,
  }),
  valueWrapper: css({
    flexShrink: 0,
    alignSelf: 'center',
    marginRight,
  }),
  activeSeries: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.maxContrast,
  }),
  copy: css({
    cursor: 'pointer',
  }),
});
