import { useMemo, useState, useRef, useEffect } from 'react';

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
  const [height, setHeight] = useState(300); // Initial height
  const containerRef = useRef<HTMLDivElement>(null);

  const onEditorChange = (expression: string) => {
    onChange({
      ...query,
      expression,
    });
  };

  // Set up resize observer to catch container height changes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { height } = entries[0].contentRect;
      setHeight(height);
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        resize: 'vertical',
        overflow: 'auto',
        minHeight: '200px',
      }}
    >
      <SQLEditor query={query.expression || initialQuery} onChange={onEditorChange} height={height} />
    </div>
  );
};
