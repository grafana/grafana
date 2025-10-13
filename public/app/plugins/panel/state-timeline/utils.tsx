import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame } from '@grafana/data';
import { Pagination } from '@grafana/ui';
import { makeFramePerSeries } from 'app/core/components/TimelineChart/utils';

import { defaultOptions } from './panelcfg.gen';

export const containerStyles = {
  container: css({
    display: 'flex',
    flexDirection: 'column',
  }),
};

const styles = {
  paginationContainer: css({
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  }),
  paginationElement: css({
    marginTop: '8px',
  }),
};

export function usePagination(frames?: DataFrame[], perPage?: number) {
  const [currentPage, setCurrentPage] = useState(1);

  const [paginationWrapperRef, { height: paginationHeight, width: paginationWidth }] = useMeasure<HTMLDivElement>();

  const pagedFrames = useMemo(
    () => (!perPage || frames == null ? frames : makeFramePerSeries(frames)),
    [frames, perPage]
  );

  if (!perPage || pagedFrames == null) {
    return {
      paginatedFrames: pagedFrames,
      paginationRev: 'disabled',
      paginationElement: undefined,
      paginationHeight: 0,
    };
  }

  perPage ||= defaultOptions.perPage!;

  const numberOfPages = Math.ceil(pagedFrames.length / perPage);
  // `perPage` changing might lead to temporarily too large values of `currentPage`.
  const currentPageCapped = Math.min(currentPage, numberOfPages);
  const pageOffset = (currentPageCapped - 1) * perPage;
  const currentPageFrames = pagedFrames.slice(pageOffset, pageOffset + perPage);

  // `paginationRev` needs to change value whenever any of the pagination settings changes.
  // It's used in to trigger a reconfiguration of the underlying graphs (which is cached,
  // hence an explicit nudge is required).
  const paginationRev = `${currentPageCapped}/${perPage}`;

  const showSmallVersion = paginationWidth < 550;
  const paginationElement = (
    <div className={styles.paginationContainer} ref={paginationWrapperRef}>
      <Pagination
        className={styles.paginationElement}
        currentPage={currentPageCapped}
        numberOfPages={numberOfPages}
        showSmallVersion={showSmallVersion}
        onNavigate={setCurrentPage}
      />
    </div>
  );

  return { paginatedFrames: currentPageFrames, paginationRev, paginationElement, paginationHeight };
}
