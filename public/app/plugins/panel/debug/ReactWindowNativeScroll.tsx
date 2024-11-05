import uFuzzy from '@leeoniya/ufuzzy';
import { useState, useMemo, useRef, CSSProperties } from 'react';
import { FixedSizeList } from 'react-window';

interface RowProps {
  index: number;
  style: CSSProperties;
  data: uFuzzy.SearchResult;
}

const Row = ({ index, style, data }: RowProps) => {
  let [haystack, idxs] = data;

  return <div style={style}>{haystack[idxs[index]]}</div>;
};

const mark = (part: string, matched: boolean, key: number) =>
  matched ? <mark key={key}>{part}</mark> : <span key={key}>{part}</span>;

const append = (accum: React.ReactNode[], part: React.ReactNode) => {
  accum.push(part);
};

const Row2 = ({ index, style, data }: RowProps) => {
  let [haystack, idxs, info, order] = data;
  let infoIdx = order[index];

  let key = 0; // :(
  let parts = uFuzzy.highlight(
    haystack[info.idx[infoIdx]],
    info.ranges[infoIdx],

    (part, matched) => mark(part, matched, key++),
    [],
    append
  );

  return (
    <div style={style} key={infoIdx}>
      {parts}
    </div>
  );
};

const uf = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraDel: 1,
  intraTrn: 1,
});

interface ReactWindowProps {
  data: string[];
}

export const ReactWindowNativeScroll = ({ data }: ReactWindowProps) => {
  const listRef = useRef();

  let allIdxs = useMemo(() => {
    let out = Array(data.length);
    for (let i = 0; i < data.length; i++) {
      out[i] = i;
    }
    return out;
  }, [data.length]);

  let [needle, setNeedle] = useState('');
  let [idxs, info, order] = useMemo(() => {
    if (needle.length === 0) {
      return [allIdxs];
    }

    console.time('filter');
    let filtered = uf.search(data, needle, 5);
    console.timeEnd('filter');

    return filtered;
  }, [needle, data, allIdxs]);

  const width = 600;
  const height = 330;

  return (
    <>
      <input
        type="text"
        placeholder="Search..."
        onInput={(e) => {
          setNeedle(e.target.value);
          listRef.current.scrollTo(0);
        }}
      />
      <FixedSizeList
        height={height}
        width={width}
        itemSize={30}
        itemData={[data, idxs, info, order]}
        itemCount={order?.length ?? idxs.length}
      >
        {order == null ? Row : Row2}
      </FixedSizeList>
    </>
  );
};
