import { css, cx } from '@emotion/css';
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

export const VizTooltipRow = ({
  label,
  value,
  color,
  colorIndicator,
  colorPlacement = ColorPlacement.first,
  justify = 'flex-start',
  isActive = false,
  marginRight = '0px',
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
    if (!(navigator?.clipboard && window.isSecureContext)) {
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
      {(color || label) && (
        <div className={styles.valueWrapper}>
          {color && colorPlacement === ColorPlacement.first && (
            <VizTooltipColorIndicator
              color={color}
              colorIndicator={colorIndicator}
              lineStyle={lineStyle}
              isHollow={isHiddenFromViz}
            />
          )}
          {!isPinned ? (
            <div className={cx(styles.label, isActive && styles.activeSeries)}>{label}</div>
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
                    className={cx(styles.label, isActive && styles.activeSeries, navigator?.clipboard && styles.copy)}
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
          <div className={cx(styles.value, isActive)} style={innerValueScrollStyle}>
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
              className={cx(styles.value, isActive, navigator?.clipboard && styles.copy)}
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

const getStyles = (theme: GrafanaTheme2, justify: string, marginRight: string) => ({
  contentWrapper: css({
    display: 'flex',
    alignItems: 'start',
    justifyContent: justify,
    marginRight: marginRight,
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontWeight: 400,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    marginRight: theme.spacing(2),
  }),
  value: css({
    fontWeight: 500,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  valueWrapper: css({
    display: 'flex',
    alignItems: 'center',
  }),
  activeSeries: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.maxContrast,
  }),
  copy: css({
    cursor: 'pointer',
  }),
});
