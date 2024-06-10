import { css, cx } from '@emotion/css';
import React, { ReactNode, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { InlineToast } from '../InlineToast/InlineToast';
import { Tooltip } from '../Tooltip';

import { ColorIndicatorPosition, VizTooltipColorIndicator } from './VizTooltipColorIndicator';
import { ColorPlacement, VizTooltipItem } from './types';

interface VizTooltipRowProps extends Omit<VizTooltipItem, 'value'> {
  value: string | number | null | ReactNode;
  justify?: string;
  isActive?: boolean; // for series list
  marginRight?: string;
  isPinned: boolean;
}

enum LabelValueTypes {
  label = 'label',
  value = 'value',
}

const SUCCESSFULLY_COPIED_TEXT = 'Copied to clipboard';
const SHOW_SUCCESS_DURATION = 2 * 1000;

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
}: VizTooltipRowProps) => {
  const styles = useStyles2(getStyles, justify, marginRight);

  const [showLabelTooltip, setShowLabelTooltip] = useState(false);
  const [showValueTooltip, setShowValueTooltip] = useState(false);

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

  const onMouseEnterValue = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget.offsetWidth < event.currentTarget.scrollWidth) {
      setShowValueTooltip(true);
    }
  };

  const onMouseLeaveValue = () => setShowValueTooltip(false);

  return (
    <div className={styles.contentWrapper}>
      {(color || label) && (
        <div className={styles.valueWrapper}>
          {color && colorPlacement === ColorPlacement.first && (
            <VizTooltipColorIndicator color={color} colorIndicator={colorIndicator} />
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
          />
        )}

        {!isPinned ? (
          <div className={cx(styles.value, isActive)}>{value}</div>
        ) : (
          <Tooltip content={value ? value.toString() : ''} interactive={false} show={showValueTooltip}>
            <>
              {showCopySuccess && copiedText?.value && (
                <InlineToast placement="top" referenceElement={valueRef.current}>
                  {SUCCESSFULLY_COPIED_TEXT}
                </InlineToast>
              )}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
              <div
                className={cx(styles.value, isActive, navigator?.clipboard && styles.copy)}
                onMouseEnter={onMouseEnterValue}
                onMouseLeave={onMouseLeaveValue}
                onClick={() => copyToClipboard(value ? value.toString() : '', LabelValueTypes.value)}
                ref={valueRef}
              >
                {value}
              </div>
            </>
          </Tooltip>
        )}

        {color && colorPlacement === ColorPlacement.trailing && (
          <VizTooltipColorIndicator
            color={color}
            colorIndicator={colorIndicator}
            position={ColorIndicatorPosition.Trailing}
          />
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, justify: string, marginRight: string) => ({
  contentWrapper: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: justify,
    flexWrap: 'wrap',
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
    minWidth: 0,
  }),
  activeSeries: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.maxContrast,
  }),
  copy: css({
    cursor: 'pointer',
  }),
});
