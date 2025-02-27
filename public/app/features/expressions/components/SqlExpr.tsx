import { useMemo, useState, useRef, useLayoutEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { SQLEditor } from '@grafana/plugin-ui';

import { ExpressionQuery } from '../types';

interface Props {
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const SqlExpr = ({ onChange, refIds, query }: Props) => {
  const vars = useMemo(() => refIds.map((v) => v.value!), [refIds]);
  const initialQuery = `select * from ${vars[0]} limit 1`;
  const initialHeight = 200; // Consistent initial height
  const [height, setHeight] = useState(initialHeight);
  const containerRef = useRef<HTMLDivElement>(null);

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
    });
  };

  // Using useLayoutEffect to avoid visual flashing
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Set initial height explicitly
    if (containerRef.current.clientHeight !== initialHeight) {
      containerRef.current.style.height = `${initialHeight}px`;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const newHeight = entries[0].contentRect.height;
      // Only update height state if it actually changed
      if (Math.abs(newHeight - height) > 1) {
        setHeight(newHeight);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [height]);

  return (
    <div
      ref={containerRef}
      style={{
        resize: 'vertical',
        overflow: 'auto',
        height: `${initialHeight}px`, // Set explicit initial height
        minHeight: '100px',
      }}
    >
      <SQLEditor query={query.expression || initialQuery} onChange={onEditorChange} height={height} />
    </div>
  );
};
