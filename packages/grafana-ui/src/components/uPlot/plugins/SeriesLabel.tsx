import React, { useMemo } from 'react';
import { GraphTransform } from '@grafana/schema';
import { useTheme2 } from '../../../themes';
import { css } from '@emotion/css';

interface SeriesLabelProps {
  transformMode?: GraphTransform;
  name: string;
}

export function SeriesLabel({ transformMode, name }: SeriesLabelProps) {
  const theme = useTheme2();
  const styles = useMemo(() => {
    return css`
      color: ${theme.colors.text.secondary};
      font-weight: normal !important;
    `;
  }, [theme]);

  return (
    <>
      {name}
      {transformMode && (
        <span className={styles}> ({transformMode === GraphTransform.NegativeY ? 'neg Y' : 'const'})</span>
      )}
    </>
  );
}
