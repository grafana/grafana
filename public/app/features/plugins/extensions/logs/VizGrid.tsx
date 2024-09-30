import { CSSProperties } from 'react';

export interface Props {
  children: React.ReactNode;
}

export function VizGrid(props: Props) {
  const style: CSSProperties = {
    display: 'grid',
    flexGrow: 1,
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gridAutoRows: '320px',
    columnGap: `8px`,
    rowGap: `8px`,
  };

  return <div style={style}>{props.children}</div>;
}
