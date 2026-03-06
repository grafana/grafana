import { css, cx } from '@emotion/css';
import { KeyboardEvent, useLayoutEffect, useRef, useState } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

const ARROW_DIRECTION: Partial<Record<string, 1 | -1>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export interface SegmentedToggleOption<T> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedToggleProps<T> {
  options: [SegmentedToggleOption<T>, SegmentedToggleOption<T>, ...Array<SegmentedToggleOption<T>>];
  value: T;
  onChange: (value: T) => void;
  showBackground?: boolean;
  'aria-label'?: string;
}

export function SegmentedToggle<T>({
  options,
  value,
  onChange,
  showBackground = true,
  'aria-label': ariaLabel,
}: SegmentedToggleProps<T>) {
  const styles = useStyles2(getStyles);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [sliderStyle, setSliderStyle] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const tab = tabRefs.current[activeIndex];
    if (tab) {
      setSliderStyle({ left: tab.offsetLeft, width: tab.offsetWidth });
    }
  }, [activeIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = ARROW_DIRECTION[e.key];
    if (direction === undefined) {
      return;
    }
    e.preventDefault();
    const nextIndex = (index + direction + options.length) % options.length;
    tabRefs.current[nextIndex]?.focus();
    onChange(options[nextIndex].value);
  };

  const sliderInlineStyle = activeIndex !== -1 && sliderStyle ? sliderStyle : { opacity: 0 };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(styles.toggle, { [styles.noBackground]: !showBackground })}
    >
      <div className={styles.slider} style={sliderInlineStyle} aria-hidden="true" />

      {options.map((option, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={String(option.value)}
            ref={(el) => (tabRefs.current[index] = el)}
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            className={cx(styles.tab, { [styles.tabActive]: isActive })}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {option.icon && <Icon name={option.icon} size="xs" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    toggle: css({
      position: 'relative',
      display: 'inline-flex',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
    }),
    noBackground: css({
      background: 'none',
    }),
    slider: css({
      position: 'absolute',
      top: '2px',
      bottom: '2px',
      background: theme.colors.background.canvas,
      borderRadius: theme.shape.radius.default,
      pointerEvents: 'none',

      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['left', 'width'], {
          duration: theme.transitions.duration.shorter,
          easing: theme.transitions.easing.easeInOut,
        }),
      },
    }),
    tab: css({
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      background: 'transparent',
      border: 'none',
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.5, 1.25),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.disabled,
      cursor: 'pointer',
      whiteSpace: 'nowrap',

      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('color', {
          duration: theme.transitions.duration.shorter,
          easing: theme.transitions.easing.easeInOut,
        }),
      },

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: '2px',
      },
    }),
    tabActive: css({
      color: theme.colors.primary.text,
    }),
  };
}
