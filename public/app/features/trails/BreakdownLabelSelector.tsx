import { css } from '@emotion/css';
import { useResizeObserver } from '@react-aria/utils';
import React, { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, RadioButtonGroup, useStyles2, useTheme2, measureText } from '@grafana/ui';

type Props = {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string | undefined) => void;
};

export function BreakdownLabelSelector({ options, value, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const [labelSelectorRequiredWidth, setLabelSelectorRequiredWidth] = useState<number>(0);
  const [availableWidth, setAvailableWidth] = useState<number>(0);

  const useHorizontalLabelSelector = availableWidth > labelSelectorRequiredWidth;

  const controlsContainer = useRef<HTMLDivElement>(null);

  useResizeObserver({
    ref: controlsContainer,
    onResize: () => {
      const element = controlsContainer.current;
      if (element) {
        setAvailableWidth(element.clientWidth);
      }
    },
  });

  useEffect(() => {
    const { fontSize } = theme.typography;
    const text = options.map((option) => option.label || option.value || '').join(' ');
    const textWidth = measureText(text, fontSize).width;
    const additionalWidthPerItem = 32;
    setLabelSelectorRequiredWidth(textWidth + additionalWidthPerItem * options.length);
  }, [options, theme]);

  return (
    <div ref={controlsContainer}>
      {useHorizontalLabelSelector ? (
        <RadioButtonGroup {...{ options, value, onChange }} />
      ) : (
        <Select {...{ options, value }} onChange={(selected) => onChange(selected.value)} className={styles.select} />
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css({
      maxWidth: theme.spacing(16),
    }),
  };
}
